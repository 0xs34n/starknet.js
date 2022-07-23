import { BlockNumber, stark } from '../src';
import { toBN } from '../src/utils/number';
import {
  IS_DEVNET,
  compiledErc20,
  compiledOpenZeppelinAccount,
  getTestProvider,
  testIfNotDevnet,
} from './fixtures';

const { compileCalldata } = stark;

const provider = getTestProvider();

describe('defaultProvider', () => {
  let exampleTransactionHash: string;
  let exampleContractAddress: string;
  let exampleBlockHash: string;
  let exampleBlockNumber: BlockNumber;
  beforeAll(async () => {
    const { code, transaction_hash, address } = await provider.deployContract({
      contract: compiledErc20,
    });
    expect(code).toBe('TRANSACTION_RECEIVED');
    await provider.waitForTransaction(transaction_hash);
    exampleTransactionHash = transaction_hash;
    exampleContractAddress = address!;
    const transaction = await provider.getTransaction(transaction_hash);

    if (transaction.status !== 'REJECTED') {
      exampleBlockHash = transaction.block_hash;
      exampleBlockNumber = transaction.block_number;
    }
  });

  describe('feeder gateway endpoints', () => {
    testIfNotDevnet('getContractAddresses()', async () => {
      // not supported in starknet-devnet
      const { GpsStatementVerifier, Starknet } = await provider.getContractAddresses();
      expect(typeof GpsStatementVerifier).toBe('string');
      expect(typeof Starknet).toBe('string');
    });
    test(`getBlock(blockHash=${exampleBlockHash}, blockNumber=undefined)`, () => {
      return expect(provider.getBlock(exampleBlockHash)).resolves.not.toThrow();
    });
    test(`getBlock(blockHash=undefined, blockNumber=${exampleBlockNumber})`, () => {
      return expect(provider.getBlock(exampleBlockNumber)).resolves.not.toThrow();
    });
    test('getBlock(blockHash=undefined, blockNumber=null)', async () => {
      const block = await provider.getBlock();

      expect(block).not.toBeNull();

      const { block_number, timestamp } = block;

      expect(typeof block_number).toEqual('number');

      return expect(typeof timestamp).toEqual('number');
    });
    test('getBlock() -> { blockNumber }', async () => {
      const block = await provider.getBlock();
      return expect(block).toHaveProperty('block_number');
    });
    test('getCode()', () => {
      return expect(provider.getCode(exampleContractAddress, 36663)).resolves.not.toThrow();
    });
    test('getCode(blockHash=undefined, blockNumber=null)', () => {
      return expect(provider.getCode(exampleContractAddress)).resolves.not.toThrow();
    });

    test(`getStateUpdate(blockHash=${exampleBlockHash}, blockNumber=undefined)`, async () => {
      const stateUpdate = await provider.getStateUpdate(exampleBlockHash);
      expect(stateUpdate).not.toBeNull();
    });
    test(`getStateUpdate(blockHash=undefined, blockNumber=${exampleBlockNumber})`, async () => {
      const stateUpdate = await provider.getStateUpdate(exampleBlockNumber);
      expect(stateUpdate).not.toBeNull();
    });
    test(`getStateUpdate(blockHash=undefined, blockNumber=undefined)`, async () => {
      const stateUpdate = await provider.getStateUpdate();
      expect(stateUpdate).not.toBeNull();
    });
    test(`getStateUpdate() -> stateUpdate`, async () => {
      const stateUpdate = await provider.getStateUpdate();
      expect(stateUpdate).not.toBeNull();
    });

    test('getStorageAt() with "key" type of number', () => {
      return expect(provider.getStorageAt(exampleContractAddress, 0, 36663)).resolves.not.toThrow();
    });
    test('getStorageAt() with "key" type of string', () => {
      return expect(
        provider.getStorageAt(exampleContractAddress, '0', 36663)
      ).resolves.not.toThrow();
    });
    test('getStorageAt() with "key" type of BN', () => {
      return expect(
        provider.getStorageAt(exampleContractAddress, toBN('0x0'), 36663)
      ).resolves.not.toThrow();
    });
    test('getStorageAt(blockHash=undefined, blockNumber=null)', () => {
      return expect(provider.getStorageAt(exampleContractAddress, 0)).resolves.not.toThrow();
    });
    test('getTransactionStatus()', async () => {
      return expect(provider.getTransactionStatus(exampleTransactionHash)).resolves.not.toThrow();
    });

    test('getTransaction() - successful transaction', async () => {
      const transaction = await provider.getTransaction(exampleTransactionHash);

      expect(transaction).not.toHaveProperty('transaction_failure_reason');

      expect(transaction.transaction).toHaveProperty('transaction_hash');

      return expect(transaction.status).not.toEqual('REJECTED');
    });

    test('getTransactionReceipt() - successful transaction', async () => {
      const transactionReceipt = await provider.getTransactionReceipt(exampleTransactionHash);

      return expect(transactionReceipt).toHaveProperty('actual_fee');
    });

    test('callContract()', () => {
      return expect(
        provider.callContract({
          contractAddress: exampleContractAddress,
          entrypoint: 'balance_of',
          calldata: compileCalldata({
            user: '0x9ff64f4ab0e1fe88df4465ade98d1ea99d5732761c39279b8e1374fa943e9b',
          }),
        })
      ).resolves.not.toThrow();
    });

    test('callContract() - gateway error', async () => {
      const promise = provider.callContract({
        contractAddress: exampleContractAddress,
        entrypoint: 'non_existent_entrypoint',
        calldata: compileCalldata({
          user: '0xdeadbeef',
        }),
      });
      expect(promise).rejects.toHaveProperty('errorCode');
      expect(promise).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Entry point 0x23b0c8b3d98aa73d8a35f5303fe77d132c6d04279e63f6e1d6aac5946e04612 not found in contract with class hash 0x2864c45bd4ba3e66d8f7855adcadf07205c88f43806ffca664f1f624765207e."`
      );

      try {
        await promise;
      } catch (e) {
        expect(e.errorCode).toMatchInlineSnapshot(
          IS_DEVNET ? `500` : `"StarknetErrorCode.ENTRY_POINT_NOT_FOUND_IN_CONTRACT"`
        );
      }
    });

    test('transaction trace', async () => {
      const transactionTrace = await provider.getTransactionTrace(exampleTransactionHash);
      expect(transactionTrace).toHaveProperty('function_invocation');
      expect(transactionTrace).toHaveProperty('signature');
    });
  });

  describe('addTransaction()', () => {
    test('declareContract()', async () => {
      const response = await provider.declareContract({
        contract: compiledErc20,
      });

      expect(response.code).toBe('TRANSACTION_RECEIVED');
      expect(response.transaction_hash).toBeDefined();
      expect(response.class_hash).toBeDefined();
    });

    test('deployContract()', async () => {
      const response = await provider.deployContract({
        contract: compiledOpenZeppelinAccount,
      });

      expect(response.code).toBe('TRANSACTION_RECEIVED');
      expect(response.transaction_hash).toBeDefined();
      expect(response.address).toBeDefined();
    });
  });
});
