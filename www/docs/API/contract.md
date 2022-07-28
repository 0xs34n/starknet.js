---
sidebar_position: 4
---

# Contract

Contracts can do data transformations in JavaScript based on an ABI. They can also call and invoke to StarkNet through a provided Signer.

Contracts allow you to transform Cairo values, like `Uint256` to `BigNumber`. It could also allow users to pass their own transformers, similar to `JSON.parse`.

## Creating an instance

`new starknet.Contract(abi, address, providerOrAccount)`

`contract.attach(providerOrAccount)` _for changing the provider or account_

`contract.connect(address)` _for changing the address of the connected contract_

## Contract properties

contract.**address** => _string_

The address the contract was constructed/connected with

contract.**providerOrAccount** => _ProviderInterface | AccountInterface_

Provider or account that are used to interact with the network

contract.**deployTransactionHash** => _string | null_

If the Contract object is the result of a ContractFactory deployment, this is the transaction which was used to deploy the contract.

contract.**abi** => _Abi_

The ABI the contract was constructed with

## Contract methods

contract.**deployed**() => _Promise < Contract >_

If the Contract object is the result of a ContractFactory deployment, this method will wait for the transaction to be resolved.

## Meta-Class

A Meta-Class is a Class which has any of its properties determined at run-time. The Contract object uses a Contract's ABI to determine what methods are available, so the following sections describe the generic ways to interact with the properties added at run-time during the Contract constructor.

### Read-Only Methods(constant)

A constant method (denoted view in Cairo) is read-only and evaluates a small amount of EVM code against the current blockchain state. It is therefore free and does not require any fee, but cannot make changes to the blockchain state...

contract.**METHOD_NAME**(...args [ , overrides ]) => _Promise < Result >_

The type of the result depends on the ABI. Result object will be returned with each parameter available positionally and if the parameter is named, it will also be available by its name.

The _overrides_ object for a read-only method may include any of:

- overrides.**blockIdentifier**

### Write Methods (non-constant)

A non-constant method requires a transaction to be signed and requires payment in the form of a fee to be paid.

contract.**METHOD_NAME**(...args [ , overrides ]) => _Promise < AddTransactionResponse >_

Returns a AddTransactionResponse for the transaction after it is sent to the network. This requires the Contract has a signer.

The _overrides_ object for write methods may include any of:

- overrides.**signature** - Signature that will be used for the transaction
- overrides.**maxFee** - Max Fee for the transaction
- overrides.**nonce** - Nonce for the transaction

### Write Methods Analysis

There are several options to analyze properties and results of a write method without actually executing it.

contract.estimateGas.**METHOD_NAME**( ...args ) => _Promise < EstimateFeeResponse >_

Returns the estimate units of gas that would be required to execute the METHOD_NAME with args and overrides.

contract.populateTransaction.**METHOD_NAME**( ...args [ , overrides ] ) ⇒ _Invocation_

Returns an _Invocation_ object which represents the transaction that would need to be signed and submitted to the network to execute METHOD_NAME with args and overrides.

The overrides are identical to the overrides above for write methods.
