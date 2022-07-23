import BN from 'bn.js';

import { BlockIdentifier } from '../provider/utils';
import { BigNumberish } from '../utils/number';
import {
  Abi,
  BlockNumber,
  CompressedCompiledContract,
  EntryPointType,
  RawCalldata,
  Signature,
  Status,
  TransactionStatus,
} from './lib';

export type Endpoints = {
  get_contract_addresses: {
    QUERY: never;
    REQUEST: never;
    RESPONSE: GetContractAddressesResponse;
  };
  add_transaction: {
    QUERY: never;
    REQUEST: Transaction;
    RESPONSE: AddTransactionResponse;
  };
  get_transaction: {
    QUERY: {
      transactionHash: string;
    };
    REQUEST: never;
    RESPONSE: GetTransactionResponse;
  };
  get_transaction_status: {
    QUERY: {
      transactionHash: string;
    };
    REQUEST: never;
    RESPONSE: GetTransactionStatusResponse;
  };
  get_transaction_trace: {
    QUERY: {
      transactionHash: string;
    };
    REQUEST: never;
    RESPONSE: GetTransactionTraceResponse;
  };
  get_transaction_receipt: {
    QUERY: {
      transactionHash: string;
    };
    REQUEST: never;
    RESPONSE: TransactionReceiptResponse;
  };
  get_storage_at: {
    QUERY: {
      contractAddress: string;
      key: BigNumberish;
      blockIdentifier: BlockIdentifier;
    };
    REQUEST: never;
    RESPONSE: object;
  };
  get_code: {
    QUERY: {
      contractAddress: string;
      blockIdentifier: BlockIdentifier;
    };
    REQUEST: never;
    RESPONSE: GetCodeResponse;
  };
  get_block: {
    QUERY: {
      blockIdentifier: BlockIdentifier;
    };
    REQUEST: never;
    RESPONSE: GetBlockResponse;
  };
  get_state_update: {
    QUERY: {
      blockIdentifier: BlockIdentifier;
    };
    REQUEST: never;
    RESPONSE: GetStateUpdateResponse;
  };
  call_contract: {
    QUERY: {
      blockIdentifier: BlockIdentifier;
    };
    REQUEST: CallContractTransaction;
    RESPONSE: CallContractResponse;
  };
  estimate_fee: {
    QUERY: {
      blockIdentifier: BlockIdentifier;
    };
    REQUEST: CallContractTransaction;
    RESPONSE: EstimateFeeResponse;
  };
};

export type GetContractAddressesResponse = {
  Starknet: string;
  GpsStatementVerifier: string;
};

export type DeclareTransaction = {
  type: 'DECLARE';
  contract_class: CompressedCompiledContract;
  nonce: BigNumberish;
  sender_address: BigNumberish;
  signature: Signature;
};

export type DeployTransaction = {
  type: 'DEPLOY';
  contract_definition: CompressedCompiledContract;
  contract_address_salt: BigNumberish;
  constructor_calldata: string[];
  nonce?: BigNumberish;
};

export type InvokeFunctionTransaction = {
  type: 'INVOKE_FUNCTION';
  contract_address: string;
  signature?: Signature;
  entry_point_type?: EntryPointType;
  entry_point_selector: string;
  calldata?: RawCalldata;
  nonce?: BigNumberish;
  max_fee?: BigNumberish;
  version?: BigNumberish;
};

export interface InvokeFunctionTransactionResponse extends InvokeFunctionTransaction {
  transaction_hash: string;
}

export type InvokeFunctionTrace = {
  caller_address: string;
  contract_address: string;
  code_address: string;
  selector: string;
  calldata: RawCalldata;
  result: Array<any>;
  execution_resources: ExecutionResources;
  internal_call: Array<InvokeFunctionTrace>;
  events: Array<any>;
  messages: Array<any>;
};

export type ExecutionResources = {
  n_steps: number;
  builtin_instance_counter: {
    pedersen_builtin: number;
    range_check_builtin: number;
    bitwise_builtin: number;
    output_builtin: number;
    ecdsa_builtin: number;
    ec_op_builtin?: number;
  };
  n_memory_holes: number;
};

export type CallContractTransaction = Omit<
  InvokeFunctionTransaction,
  'type' | 'entry_point_type' | 'nonce'
>;

export type Transaction = DeclareTransaction | DeployTransaction | InvokeFunctionTransaction;
export type TransactionResponse =
  | DeclareTransaction
  | DeployTransaction
  | InvokeFunctionTransactionResponse;

export type CallContractResponse = {
  result: string[];
};

export type GetBlockResponse = {
  block_number: number;
  state_root: string;
  block_hash: string;
  transactions: {
    [txHash: string]: TransactionResponse;
  };
  timestamp: number;
  transaction_receipts: {
    [txHash: string]: {
      block_hash: string;
      transaction_hash: string;
      l2_to_l1_messages: {
        to_address: string;
        payload: string[];
        from_address: string;
      }[];
      block_number: BlockNumber;
      status: Status;
      transaction_index: number;
    };
  };
  parent_block_hash: string;
  status: Status;
  gas_price: string;
  starknet_version?: string;
};

export type GetCodeResponse = {
  bytecode: string[];
  abi: Abi;
};

type StateDiffItem = {
  address: string;
  key: string;
  value: string;
};

type DeclaredContractItem = {
  class_hash: string;
};

type DeployedContractItem = {
  address: string;
  class_hash: string;
};

type Nonces = {
  contract_address: string;
  nonce: BigNumberish;
};

export type GetStateUpdateResponse = {
  block_hash: string;
  new_root: string;
  old_root: string;
  accepted_time: number;
  state_diff: {
    storage_diffs: Array<StateDiffItem>;
    declared_contracts: Array<DeclaredContractItem>;
    deployed_contracts: Array<DeployedContractItem>;
    nonces: Array<Nonces>;
  };
};

export type GetTransactionStatusResponse = {
  tx_status: Status;
  block_hash?: string;
  tx_failure_reason?: {
    code: string;
    error_message: string;
  };
};

export type GetTransactionTraceResponse = {
  function_invocation: {
    caller_address: string;
    contract_address: string;
    code_address: string;
    selector: string;
    calldata: RawArgs;
    result: Array<any>;
    execution_resources: ExecutionResources;
    internal_call: Array<any>;
    events: Array<any>;
    messages: Array<any>;
  };
  signature: Signature;
};

export type SuccessfulTransactionResponse = {
  status: Status;
  transaction: TransactionResponse;
  block_hash: string;
  block_number: BlockNumber;
  transaction_index: number;
};

export type FailedTransactionResponse = {
  status: 'REJECTED';
  transaction_failure_reason: {
    code: string;
    error_message: string;
  };
  transaction: TransactionResponse;
};

export type GetTransactionResponse = SuccessfulTransactionResponse | FailedTransactionResponse;

export type AddTransactionResponse = {
  code: TransactionStatus;
  transaction_hash: string;
  address?: string;
  class_hash?: string;
};

export type SuccessfulTransactionReceiptResponse = {
  status: Status;
  transaction_hash: string;
  transaction_index: number;
  block_hash: string;
  block_number: BlockNumber;
  l2_to_l1_messages: string[];
  events: string[];
  actual_fee: string;
  execution_resources: ExecutionResources;
};

export type FailedTransactionReceiptResponse = {
  status: 'REJECTED';
  transaction_failure_reason: {
    code: string;
    error_message: string;
  };
  transaction_hash: string;
  l2_to_l1_messages: string[];
  events: string[];
};

export type TransactionReceiptResponse =
  | SuccessfulTransactionReceiptResponse
  | FailedTransactionReceiptResponse;

// Support 0.9.1 changes in a backward-compatible way
export type EstimateFeeResponse = {
  overall_fee?: BN;
  amount?: BN;
  unit: string;
  gas_price?: BN;
  gas_usage?: BigNumberish;
};

export type RawArgs = {
  [inputName: string]: string | string[] | { type: 'struct'; [k: string]: BigNumberish };
};

export type Calldata = string[];

export type Overrides = {
  maxFee?: BigNumberish;
  nonce?: BigNumberish;
  signature?: Signature;
};
