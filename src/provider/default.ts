import urljoin from 'url-join';

import { ONE, StarknetChainId, ZERO } from '../constants';
import {
  Abi,
  AddTransactionResponse,
  Call,
  CallContractResponse,
  CompiledContract,
  DeclareContractPayload,
  DeployContractPayload,
  Endpoints,
  GetBlockResponse,
  GetCodeResponse,
  GetContractAddressesResponse,
  GetStateUpdateResponse,
  GetTransactionResponse,
  GetTransactionStatusResponse,
  GetTransactionTraceResponse,
  Invocation,
  TransactionReceiptResponse,
} from '../types';
import { getSelectorFromName } from '../utils/hash';
import { parse, parseAlwaysAsBig, stringify } from '../utils/json';
import { BigNumberish, bigNumberishArrayToDecimalStringArray, toBN, toHex } from '../utils/number';
import { compressProgram, randomAddress } from '../utils/stark';
import { GatewayError, HttpError } from './errors';
import { ProviderInterface } from './interface';
import { BlockIdentifier, getFormattedBlockIdentifier } from './utils';

type NetworkName = 'mainnet-alpha' | 'goerli-alpha';

type ProviderOptions = { network: NetworkName } | { baseUrl: string };

function wait(delay: number) {
  return new Promise((res) => {
    setTimeout(res, delay);
  });
}

function isEmptyQueryObject(obj?: Record<any, any>): obj is undefined {
  return (
    obj === undefined ||
    Object.keys(obj).length === 0 ||
    (Object.keys(obj).length === 1 &&
      Object.entries(obj).every(([k, v]) => k === 'blockIdentifier' && v === null))
  );
}

export class Provider implements ProviderInterface {
  public baseUrl: string;

  public feederGatewayUrl: string;

  public gatewayUrl: string;

  public chainId: StarknetChainId;

  constructor(
    optionsOrProvider: ProviderOptions | ProviderInterface = { network: 'goerli-alpha' }
  ) {
    if (optionsOrProvider instanceof ProviderInterface) {
      this.baseUrl = optionsOrProvider.baseUrl;
      this.feederGatewayUrl = optionsOrProvider.feederGatewayUrl;
      this.gatewayUrl = optionsOrProvider.gatewayUrl;
      this.chainId =
        optionsOrProvider.chainId ?? Provider.getChainIdFromBaseUrl(optionsOrProvider.baseUrl);
    } else {
      const baseUrl =
        'baseUrl' in optionsOrProvider
          ? optionsOrProvider.baseUrl
          : Provider.getNetworkFromName(optionsOrProvider.network);
      this.baseUrl = baseUrl;
      this.chainId = Provider.getChainIdFromBaseUrl(baseUrl);
      this.feederGatewayUrl = urljoin(baseUrl, 'feeder_gateway');
      this.gatewayUrl = urljoin(baseUrl, 'gateway');
    }
  }

  protected static getNetworkFromName(name: NetworkName) {
    switch (name) {
      case 'mainnet-alpha':
        return 'https://alpha-mainnet.starknet.io';
      case 'goerli-alpha':
      default:
        return 'https://alpha4.starknet.io';
    }
  }

  protected static getChainIdFromBaseUrl(baseUrl: string): StarknetChainId {
    try {
      const url = new URL(baseUrl);
      if (url.host.includes('mainnet.starknet.io')) {
        return StarknetChainId.MAINNET;
      }
    } catch {
      // eslint-disable-next-line no-console
      console.error(`Could not parse baseUrl: ${baseUrl}`);
    }
    return StarknetChainId.TESTNET;
  }

  private getFetchUrl(endpoint: keyof Endpoints) {
    const gatewayUrlEndpoints = ['add_transaction'];

    return gatewayUrlEndpoints.includes(endpoint) ? this.gatewayUrl : this.feederGatewayUrl;
  }

  private getFetchMethod(endpoint: keyof Endpoints) {
    const postMethodEndpoints = ['add_transaction', 'call_contract', 'estimate_fee'];

    return postMethodEndpoints.includes(endpoint) ? 'POST' : 'GET';
  }

  private getQueryString(query?: Record<string, any>): string {
    if (isEmptyQueryObject(query)) {
      return '';
    }
    const queryString = Object.entries(query)
      .map(([key, value]) => {
        if (key === 'blockIdentifier') {
          return `${getFormattedBlockIdentifier(value)}`;
        }
        return `${key}=${value}`;
      })
      .join('&');

    return `?${queryString}`;
  }

  private getHeaders(method: 'POST' | 'GET'): Record<string, string> | undefined {
    if (method === 'POST') {
      return {
        'Content-Type': 'application/json',
      };
    }
    return undefined;
  }

  // typesafe fetch
  protected async fetchEndpoint<T extends keyof Endpoints>(
    endpoint: T,
    // typescript type magiuc to create a nice fitting function interface
    ...[query, request]: Endpoints[T]['QUERY'] extends never
      ? Endpoints[T]['REQUEST'] extends never
        ? [] // when no query and no request is needed, we can omit the query and request parameters
        : [undefined, Endpoints[T]['REQUEST']]
      : Endpoints[T]['REQUEST'] extends never
      ? [Endpoints[T]['QUERY']] // when no request is needed, we can omit the request parameter
      : [Endpoints[T]['QUERY'], Endpoints[T]['REQUEST']] // when both query and request are needed, we cant omit anything
  ): Promise<Endpoints[T]['RESPONSE']> {
    const baseUrl = this.getFetchUrl(endpoint);
    const method = this.getFetchMethod(endpoint);
    const queryString = this.getQueryString(query);
    const headers = this.getHeaders(method);
    const url = urljoin(baseUrl, endpoint, queryString);

    try {
      const res = await fetch(url, {
        method,
        body: stringify(request),
        headers,
      });
      const textResponse = await res.text();
      if (!res.ok) {
        // This will allow user to handle contract errors
        let responseBody: any;
        try {
          responseBody = parse(textResponse);
        } catch {
          // if error parsing fails, return an http error
          throw new HttpError(res.statusText, res.status);
        }

        const errorCode = responseBody.code || ((responseBody as any)?.status_code as string); // starknet-devnet uses status_code instead of code; They need to fix that
        throw new GatewayError(responseBody.message, errorCode); // Caught locally, and re-thrown for the user
      }

      if (endpoint === 'estimate_fee') {
        return parseAlwaysAsBig(textResponse, (_, v) => {
          if (v && typeof v === 'bigint') {
            return toBN(v.toString());
          }
          return v;
        });
      }
      return parse(textResponse) as Endpoints[T]['RESPONSE'];
    } catch (err) {
      // rethrow custom errors
      if (err instanceof GatewayError || err instanceof HttpError) {
        throw err;
      }
      if (err instanceof Error) {
        throw Error(`Could not ${method} from endpoint \`${url}\`: ${err.message}`);
      }
      throw err;
    }
  }

  /**
   * Gets the smart contract address on the goerli testnet.
   *
   * [Reference](https://github.com/starkware-libs/cairo-lang/blob/f464ec4797361b6be8989e36e02ec690e74ef285/src/starkware/starknet/services/api/feeder_gateway/feeder_gateway_client.py#L13-L15)
   * @returns starknet smart contract addresses
   */
  public async getContractAddresses(): Promise<GetContractAddressesResponse> {
    return this.fetchEndpoint('get_contract_addresses');
  }

  /**
   * Calls a function on the StarkNet contract.
   *
   * [Reference](https://github.com/starkware-libs/cairo-lang/blob/fc97bdd8322a7df043c87c371634b26c15ed6cee/src/starkware/starknet/services/api/feeder_gateway/feeder_gateway_client.py#L25-L39)
   *
   * @param invokeTransaction - transaction to be invoked
   * @param blockHash
   * @param blockNumber
   * @returns the result of the function on the smart contract.
   */
  public async callContract(
    { contractAddress, entrypoint, calldata = [] }: Call,
    { blockIdentifier = 'pending' }: { blockIdentifier?: BlockIdentifier } = {}
  ): Promise<CallContractResponse> {
    return this.fetchEndpoint(
      'call_contract',
      { blockIdentifier },
      {
        signature: [],
        contract_address: contractAddress,
        entry_point_selector: getSelectorFromName(entrypoint),
        calldata,
      }
    );
  }

  /**
   * Gets the block information
   *
   * [Reference](https://github.com/starkware-libs/cairo-lang/blob/fc97bdd8322a7df043c87c371634b26c15ed6cee/src/starkware/starknet/services/api/feeder_gateway/feeder_gateway_client.py#L41-L53)
   *
   * @param blockHash
   * @param blockNumber
   * @returns the block object { block_number, previous_block_number, state_root, status, timestamp, transaction_receipts, transactions }
   */
  public async getBlock(blockIdentifier: BlockIdentifier = null): Promise<GetBlockResponse> {
    return this.fetchEndpoint('get_block', { blockIdentifier });
  }

  /**
   * Gets the code of the deployed contract.
   *
   * [Reference](https://github.com/starkware-libs/cairo-lang/blob/fc97bdd8322a7df043c87c371634b26c15ed6cee/src/starkware/starknet/services/api/feeder_gateway/feeder_gateway_client.py#L55-L68)
   *
   * @param contractAddress
   * @param blockHash
   * @param blockNumber
   * @returns Bytecode and ABI of compiled contract
   */
  public async getCode(
    contractAddress: string,
    blockIdentifier: BlockIdentifier = 'pending'
  ): Promise<GetCodeResponse> {
    return this.fetchEndpoint('get_code', { blockIdentifier, contractAddress });
  }

  /**
   * Same as interface GetStateUpdate
   *
   * @param blockIdentifier
   * @returns {Promise}
   */
  public async getStateUpdate(
    blockIdentifier: BlockIdentifier = null
  ): Promise<GetStateUpdateResponse> {
    return this.fetchEndpoint('get_state_update', { blockIdentifier });
  }

  // TODO: add proper type
  /**
   * Gets the contract's storage variable at a specific key.
   *
   * [Reference](https://github.com/starkware-libs/cairo-lang/blob/fc97bdd8322a7df043c87c371634b26c15ed6cee/src/starkware/starknet/services/api/feeder_gateway/feeder_gateway_client.py#L70-L85)
   *
   * @param contractAddress
   * @param key - from getStorageVarAddress('<STORAGE_VARIABLE_NAME>') (WIP)
   * @param blockHash
   * @param blockNumber
   * @returns the value of the storage variable
   */
  public async getStorageAt(
    contractAddress: string,
    key: BigNumberish,
    blockIdentifier: BlockIdentifier = 'pending'
  ): Promise<object> {
    return this.fetchEndpoint('get_storage_at', { blockIdentifier, contractAddress, key });
  }

  /**
   * Gets the status of a transaction.
   *
   * [Reference](https://github.com/starkware-libs/cairo-lang/blob/f464ec4797361b6be8989e36e02ec690e74ef285/src/starkware/starknet/services/api/feeder_gateway/feeder_gateway_client.py#L48-L52)
   *
   * @param txHash
   * @returns the transaction status object { block_number, tx_status: NOT_RECEIVED | RECEIVED | PENDING | REJECTED | ACCEPTED_ONCHAIN }
   */
  public async getTransactionStatus(txHash: BigNumberish): Promise<GetTransactionStatusResponse> {
    const txHashHex = toHex(toBN(txHash));
    return this.fetchEndpoint('get_transaction_status', { transactionHash: txHashHex });
  }

  /**
   * Gets the transaction receipt from a tx hash.
   *
   * [Reference] (https://github.com/starkware-libs/cairo-lang/blob/167b28bcd940fd25ea3816204fa882a0b0a49603/src/starkware/starknet/services/api/feeder_gateway/feeder_gateway_client.py#L183)
   *
   * @param txHash
   * @returns the transaction receipt object
   */
  public async getTransactionReceipt(txHash: BigNumberish): Promise<TransactionReceiptResponse> {
    const txHashHex = toHex(toBN(txHash));
    return this.fetchEndpoint('get_transaction_receipt', { transactionHash: txHashHex });
  }

  /**
   * Gets the transaction information from a tx id.
   *
   * [Reference](https://github.com/starkware-libs/cairo-lang/blob/f464ec4797361b6be8989e36e02ec690e74ef285/src/starkware/starknet/services/api/feeder_gateway/feeder_gateway_client.py#L54-L58)
   *
   * @param txHash
   * @returns the transacton object { transaction_id, status, transaction, block_number?, block_number?, transaction_index?, transaction_failure_reason? }
   */
  public async getTransaction(txHash: BigNumberish): Promise<GetTransactionResponse> {
    const txHashHex = toHex(toBN(txHash));
    return this.fetchEndpoint('get_transaction', { transactionHash: txHashHex });
  }

  /**
   * Gets the transaction trace from a tx id.
   *
   *
   * @param txHash
   * @returns the transaction trace
   */
  public async getTransactionTrace(txHash: BigNumberish): Promise<GetTransactionTraceResponse> {
    const txHashHex = toHex(toBN(txHash));
    return this.fetchEndpoint('get_transaction_trace', { transactionHash: txHashHex });
  }

  /**
   * Declare a given compiled contract (json) on starknet
   *
   * @param contract - a json object containing the compiled contract
   * @returns a confirmation of sending a transaction on the starknet contract
   */
  public declareContract(payload: DeclareContractPayload): Promise<AddTransactionResponse> {
    const parsedContract =
      typeof payload.contract === 'string'
        ? (parse(payload.contract) as CompiledContract)
        : payload.contract;
    const contractDefinition = {
      ...parsedContract,
      program: compressProgram(parsedContract.program),
    };

    return this.fetchEndpoint('add_transaction', undefined, {
      type: 'DECLARE',
      contract_class: contractDefinition,
      nonce: toHex(ZERO),
      signature: [],
      sender_address: toHex(ONE),
    });
  }

  /**
   * Deploys a given compiled contract (json) to starknet
   *
   * @param contract - a json object containing the compiled contract
   * @param address - (optional, defaults to a random address) the address where the contract should be deployed (alpha)
   * @returns a confirmation of sending a transaction on the starknet contract
   */
  public deployContract(
    payload: DeployContractPayload,
    _abi?: Abi
  ): Promise<AddTransactionResponse> {
    const parsedContract =
      typeof payload.contract === 'string'
        ? (parse(payload.contract) as CompiledContract)
        : payload.contract;
    const contractDefinition = {
      ...parsedContract,
      program: compressProgram(parsedContract.program),
    };

    return this.fetchEndpoint('add_transaction', undefined, {
      type: 'DEPLOY',
      contract_address_salt: payload.addressSalt ?? randomAddress(),
      constructor_calldata: bigNumberishArrayToDecimalStringArray(
        payload.constructorCalldata ?? []
      ),
      contract_definition: contractDefinition,
    });
  }

  /**
   * Invokes a function on starknet
   * @deprecated This method wont be supported as soon as fees are mandatory
   *
   * @param invocation
   * @param _abi - (optional) signature to send along
   * @returns response from addTransaction
   */
  public invokeFunction(invocation: Invocation, _abi?: Abi): Promise<AddTransactionResponse> {
    return this.fetchEndpoint('add_transaction', undefined, {
      type: 'INVOKE_FUNCTION',
      contract_address: invocation.contractAddress,
      entry_point_selector: getSelectorFromName(invocation.entrypoint),
      calldata: bigNumberishArrayToDecimalStringArray(invocation.calldata ?? []),
      signature: bigNumberishArrayToDecimalStringArray(invocation.signature ?? []),
    });
  }

  public async waitForTransaction(txHash: BigNumberish, retryInterval: number = 8000) {
    let onchain = false;

    while (!onchain) {
      // eslint-disable-next-line no-await-in-loop
      await wait(retryInterval);
      // eslint-disable-next-line no-await-in-loop
      const res = await this.getTransactionStatus(txHash);

      const successStates = ['ACCEPTED_ON_L1', 'ACCEPTED_ON_L2', 'PENDING'];
      const errorStates = ['REJECTED', 'NOT_RECEIVED'];

      if (successStates.includes(res.tx_status)) {
        onchain = true;
      } else if (errorStates.includes(res.tx_status)) {
        const message = res.tx_failure_reason
          ? `${res.tx_status}: ${res.tx_failure_reason.code}\n${res.tx_failure_reason.error_message}`
          : res.tx_status;
        const error = new Error(message) as Error & { response: GetTransactionStatusResponse };
        error.response = res;
        throw error;
      }
    }
  }

  /**
   * @deprecated use `waitForTransaction` instead
   */
  public async waitForTx(txHash: BigNumberish, retryInterval: number = 8000) {
    return this.waitForTransaction(txHash, retryInterval);
  }
}
