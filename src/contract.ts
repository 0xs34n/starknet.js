import BN from 'bn.js';
import assert from 'minimalistic-assert';

import { Provider, defaultProvider } from './provider';
import { Abi, AbiEntry, FunctionAbi, StructAbi } from './types';
import { BigNumberish, toBN } from './utils/number';
import { getSelectorFromName } from './utils/stark';

export type Args = { [inputName: string]: string | string[] };
export type Calldata = string[];

function parseFelt(candidate: string): BN {
  try {
    return toBN(candidate);
  } catch (e) {
    throw Error('Couldnt parse felt');
  }
}

function isFelt(candidate: string): boolean {
  try {
    parseFelt(candidate);
    return true;
  } catch (e) {
    return false;
  }
}

export function compileCalldata(args: Args): Calldata {
  return Object.values(args).flatMap((value) => {
    if (Array.isArray(value))
      return [toBN(value.length).toString(), ...value.map((x) => toBN(x).toString())];
    return toBN(value).toString();
  });
}

export class Contract {
  connectedTo: string | null = null;

  abi: Abi[];

  structs: { [name: string]: StructAbi };

  provider: Provider;

  /**
   * Contract class to handle contract methods
   *
   * @param abi - Abi of the contract object
   * @param address (optional) - address to connect to
   */
  constructor(abi: Abi[], address: string | null = null, provider: Provider = defaultProvider) {
    this.connectedTo = address;
    this.provider = provider;
    this.abi = abi;
    this.structs = abi
      .filter((abiEntry) => abiEntry.type === 'struct')
      .reduce(
        (acc, abiEntry) => ({
          ...acc,
          [abiEntry.name]: abiEntry,
        }),
        {}
      );
  }

  public connect(address: string): Contract {
    this.connectedTo = address;
    return this;
  }

  private validateMethodAndArgs(type: 'INVOKE' | 'CALL', method: string, args: Args = {}) {
    // ensure provided method exists
    const invokeableFunctionNames = this.abi
      .filter((abi) => {
        if (abi.type !== 'function') return false;
        const isView = abi.stateMutability === 'view';
        return type === 'INVOKE' ? !isView : isView;
      })
      .map((abi) => abi.name);
    assert(
      invokeableFunctionNames.includes(method),
      `${type === 'INVOKE' ? 'invokeable' : 'viewable'} method not found in abi`
    );

    // ensure args match abi type
    const methodAbi = this.abi.find(
      (abi) => abi.name === method && abi.type === 'function'
    ) as FunctionAbi;
    methodAbi.inputs.forEach((input) => {
      if (args[input.name] !== undefined) {
        if (input.type === 'felt') {
          assert(
            typeof args[input.name] === 'string',
            `arg ${input.name} should be a felt (string)`
          );
          assert(
            isFelt(args[input.name] as string),
            `arg ${input.name} should be decimal or hexadecimal`
          );
        } else {
          assert(Array.isArray(args[input.name]), `arg ${input.name} should be a felt* (string[])`);
          (args[input.name] as string[]).forEach((felt, i) => {
            assert(
              typeof felt === 'string',
              `arg ${input.name}[${i}] should be a felt (string) as part of a felt* (string[])`
            );
            assert(
              isFelt(felt),
              `arg ${input.name}[${i}] should be decimal or hexadecimal as part of a felt* (string[])`
            );
          });
        }
      }
    });
  }

  private parseResponseField(
    element: AbiEntry | FunctionAbi,
    responseIterator: Iterator<string>
  ): Args {
    let entries: AbiEntry[] = [];
    if (['felt', 'felt*'].includes(element.type)) {
      return responseIterator.next().value;
    }
    if (element.type in this.structs) {
      entries = this.structs[element.type].members;
    } else if ('outputs' in element) {
      entries = element.outputs;
    }
    return entries.reduce(
      (acc, member) => ({
        ...acc,
        [member.name]: this.parseResponseField(member, responseIterator),
      }),
      {}
    );
  }

  private parseResponse(method: string, response: string[]): Args {
    const methodAbi = this.abi.find((abi) => abi.name === method) as FunctionAbi;
    const responseIterator = response.flat()[Symbol.iterator]();
    return this.parseResponseField(methodAbi, responseIterator);
  }

  public invoke(method: string, args: Args = {}, signature?: [BigNumberish, BigNumberish]) {
    // ensure contract is connected
    assert(this.connectedTo !== null, 'contract isnt connected to an address');

    // validate method and args
    this.validateMethodAndArgs('INVOKE', method, args);

    // compile calldata
    const entrypointSelector = getSelectorFromName(method);
    const calldata = compileCalldata(args);

    return this.provider.addTransaction({
      type: 'INVOKE_FUNCTION',
      contract_address: this.connectedTo,
      signature,
      calldata,
      entry_point_selector: entrypointSelector,
    });
  }

  public async call(method: string, args: Args = {}) {
    // ensure contract is connected
    assert(this.connectedTo !== null, 'contract isnt connected to an address');

    // validate method and args
    this.validateMethodAndArgs('CALL', method, args);

    // compile calldata
    const entrypointSelector = getSelectorFromName(method);
    const calldata = compileCalldata(args);

    return this.provider
      .callContract({
        contract_address: this.connectedTo,
        calldata,
        entry_point_selector: entrypointSelector,
      })
      .then((x) => this.parseResponse(method, x.result));
  }
}
