import { Contract, ContractFactory, Wallet, BigNumber } from "ethers";
import VM from "ethereumjs-vm";
import { Transaction } from "ethereumjs-tx";
import Account from "ethereumjs-account";
import { bufferify, getAddressFromPrivateKey, toBN } from "@connext/utils";
// Get artifacts
import SimpleLinkedTransferApp from "../artifacts/SimpleLinkedTransferApp.json";
import {
  getSimpleLinkedTransferInfo,
  encodeState,
  encodeAction,
  decodeState,
  provider,
  expect,
} from "./utils";
import { promisify } from "util";
import { hexlify, getAddress } from "ethers/lib/utils";

async function getAccountNonce(vm: VM, pk: string) {
  const account = (await promisify(
    vm.stateManager.getAccount.bind(vm.stateManager)
  )(bufferify(getAddressFromPrivateKey(pk)))) as Account;

  return account.nonce;
}

describe.only("Pure evm with view function", () => {
  let simpleLinkedTransferApp: Contract;

  // Constants
  let wallet: Wallet;
  let state;
  let action;

  beforeEach(async () => {
    // Deploy contract
    wallet = (await provider.getWallets())[0];
    const deploy = await new ContractFactory(
      SimpleLinkedTransferApp.abi,
      SimpleLinkedTransferApp.bytecode,
      wallet
    ).deploy();
    simpleLinkedTransferApp = await deploy.deployed();

    // Setup test constants
    const res = getSimpleLinkedTransferInfo();
    state = res.state;
    action = res.action;
  });

  it.only("should be able to call applyAction using eth-js", async () => {
    // Add wallet to VM
    const vm = new VM();
    const account = new Account({
      balance: (await wallet.getBalance()).toHexString(),
    });
    vm.stateManager.putAccount(bufferify(wallet.address), account, () => {});

    // Deploy contract to vm
    const bytecode = SimpleLinkedTransferApp.bytecode;
    const tx = new Transaction({
      gasLimit: toBN(2000000).toHexString(), // We assume that 2M is enough,
      gasPrice: toBN(1).toHexString(),
      data: bytecode,
      nonce: await getAccountNonce(vm, wallet.privateKey),
    });
    tx.sign(bufferify(wallet.privateKey));
    const deploymentResult = await vm.runTx({ tx });
    expect(deploymentResult.execResult.exceptionError).to.be.undefined;

    const appDef = getAddress(hexlify(deploymentResult.createdAddress!));
    expect(appDef).to.be.eq(simpleLinkedTransferApp.address);

    // // Execute on evm, decode output

    // const evmDecoded = {};

    // // Execute on contract, decode output
    // const encoded = await simpleLinkedTransferApp.functions.applyAction(
    //   encodeState(state),
    //   encodeAction(action)
    // );
    // const contractDecoded = decodeState(encoded);

    // // Verify both values are the same once decoded
    // expect(evmDecoded).to.containSubset(contractDecoded);
  });
});
