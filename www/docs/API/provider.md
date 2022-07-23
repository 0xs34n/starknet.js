---
sidebar_position: 1
---

# Provider

The **Provider** API allows you to interface with the StarkNet network, without signing transactions or messages.

Typically, these are _read_ calls on the blockchain.

## Creating an instance

`new starknet.Provider(optionsOrProvider)`

The options for the provider depends from the network. The structure of the options object is:

- options.**baseUrl** - Base URL of the network
- options.**feederGatewayUrl** - Feeder Gateway Endpoint of the network
- options.**gatewayUrl** - Gateway Endpoint

Example:

```
const provider = new starknet.Provider({
    baseUrl: 'https://alpha4.starknet.io',
    feederGatewayUrl: 'feeder_gateway',
    gatewayUrl: 'gateway',
})
```

**This is also default options for the constructor for the **testnet\*\*\*

## Methods

Gets the smart contract address on the network

provider.**getContractAddresses**() => _Promise < GetContractAddressesResponse >_

```
{
  Starknet: string;
  GpsStatementVerifier: string;
}
```

<hr/>

provider.**callContract**(call [ , options ]) => _Promise < CallContractResponse >_

Calls a function on the StarkNet contract.

The call object structure:

- call.**contractAddress** - Address of the contract
- call.**entrypoint** - Entrypoint of the call (method name)
- call.**calldata** - Payload for the invoking the method

The options object structure:

- options.**blockIdentifier**

###### CallContractResponse

```
{
    result: string[];
}
```

<hr/>

provider.**getBlock**(blockIdentifire) => _Promise < GetBlockResponse >_

Gets the block information.

###### _GetBlockResponse_

```
{
  block_hash: string;
  parent_block_hash: string;
  block_number: number;
  state_root: string;
  status: 'NOT_RECEIVED' | 'RECEIVED' | 'PENDING' | 'ACCEPTED_ON_L2' | 'ACCEPTED_ON_L1' | 'REJECTED';
  transation: Transaction[];
  timestamp: number;
  transaction_receipts: [];
  starknet_version: string;
}
```

<hr/>

provider.**getCode**(contractAddress, blockIdentifire) => _Promise < GetCodeResponse >_

Gets the code of the deployed contract.

###### _GetCodeResponse_

```
{
  bytecode: string[];
  abi: Abi;
}
```

<hr/>

provider.**GetStateUpdate**(blockIdentifire) => _Promise < GetStateUpdateResponse >_

Gets the block execution information for requested block.

###### _GetStateUpdateResponse_

```
{
  block_hash: string;
  new_root: string;
  old_root: string;
  accepted_time: number;
  state_diff: {
    storage_diffs: Array<StateDiffItem>;
    declared_contracts: Array<DeclaredContractItem>;
    deployed_contracts: Array<DeployedContractItem>;
    nonces: Array<Nonces>
  }
}
```

<hr/>

provider.**getStorageAt**(contractAddress, key, blockIdentifire) => _Promise < any >_

Gets the contract's storage variable at a specific key

<hr/>

provider.**getTransactionStatus**(txHash) => _Promise < GetTransactionStatusResponse >_

Gets the status of a transaction.

###### _GetTransactionStatusResponse_

```
{
  tx_status: 'NOT_RECEIVED' | 'RECEIVED' | 'PENDING' | 'ACCEPTED_ON_L2' | 'ACCEPTED_ON_L1' | 'REJECTED';
  block_hash: string;
  tx_failure_reason?: {
    tx_id: number;
    code: string;
    error_message: string;
  }
}
```

<hr/>

provider.**getTransactionReceipt**(txHash) => _Promise < TransactionReceiptResponse >_

Gets the status of a transaction.

###### _TransactionReceiptResponse_

```
{
  status: 'NOT_RECEIVED' | 'RECEIVED' | 'PENDING' | 'ACCEPTED_ON_L2' | 'ACCEPTED_ON_L1' | 'REJECTED';
  transaction_hash: string;
  transaction_index: number;
  block_hash: string;
  block_number: 'pending' | null | number;
  l2_to_l1_messages: string[];
  events: string[];
}
```

<hr/>

provider.**getTransaction**(txHash) => _Promise < GetTransactionResponse >_

Gets the transaction information from a tx hash.

###### _GetTransactionResponse_

```
{
    status: 'NOT_RECEIVED' | 'RECEIVED' | 'PENDING' | 'ACCEPTED_ON_L2' | 'ACCEPTED_ON_L1' | 'REJECTED';
    transaction: Transaction;
    block_hash: string;
    block_number: 'pending' | null | number;
    transaction_index: number;
    transaction_hash: string;
}
```

<hr/>

provider.**getTransactionTrace**(txHash) => _Promise < GetTransactionTraceResponse >_

Gets the transaction trace from a tx hash.

###### _GetTransactionTraceResponse_

```
{
  function_invocation: {
    caller_address: string;
    contract_address: string;
    code_address: string;
    selector: string;
    calldata: {
        [inputName: string]: string | string[] | { type: 'struct'; [k: string]: BigNumberish };
    };
    result: Array<any>;
    execution_resources: any;
    internal_call: Array<any>;
    events: Array<any>;
    messages: Array<any>;
  };
  signature: Signature;
}
```

<hr/>

provider.**declareContract**(payload) => _Promise < AddTransactionResponse >_

Declares a contract on Starknet

###### _AddTransactionResponse_

```
{
  code: 'TRANSACTION_RECEIVED';
  transaction_hash: string;
  class_hash: string;
};

<hr/>

```

provider.**deployContract**(payload [ , abi ]) => _Promise < AddTransactionResponse >_

Deploys a contract on Starknet

###### _AddTransactionResponse_

```
{
  code: 'TRANSACTION_RECEIVED';
  transaction_hash: string;
  address?: string;
};
```
