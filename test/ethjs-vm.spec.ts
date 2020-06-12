import { Contract, ContractFactory, Wallet, BigNumber } from 'ethers'
import VM from 'ethereumjs-vm'
import { Transaction } from 'ethereumjs-tx'
import Account from 'ethereumjs-account'
import abi from 'ethereumjs-abi'
import { bufferify, getAddressFromPrivateKey, toBN } from '@connext/utils'
// Get artifacts
import SimpleLinkedTransferApp from '../artifacts/SimpleLinkedTransferApp.json'
import {
  getSimpleLinkedTransferInfo,
  encodeState,
  encodeAction,
  decodeState,
  provider,
  expect,
} from './utils'
import { promisify } from 'util'
import { hexlify, getAddress } from 'ethers/lib/utils'

async function getAccountNonce(vm: VM, pk: string) {
  const account = (await promisify(
    vm.stateManager.getAccount.bind(vm.stateManager)
  )(bufferify(getAddressFromPrivateKey(pk)))) as Account

  return account.nonce
}

describe('Pure evm with view function', () => {
  let simpleLinkedTransferApp: Contract

  // Constants
  let wallet: Wallet
  let state
  let action
  let functionData

  beforeEach(async () => {
    // Deploy contract
    wallet = (await provider.getWallets())[0]
    const deploy = await new ContractFactory(
      SimpleLinkedTransferApp.abi,
      SimpleLinkedTransferApp.bytecode,
      wallet
    ).deploy()
    simpleLinkedTransferApp = await deploy.deployed()

    // Setup test constants
    const res = getSimpleLinkedTransferInfo()
    state = res.state
    action = res.action
    functionData = simpleLinkedTransferApp.interface.encodeFunctionData(
      'applyAction',
      [encodeState(state), encodeAction(action)]
    )
  })

  it('should be able to call applyAction using eth-js', async () => {
    // Add wallet to VM
    const vm = new VM()
    const account = new Account({
      balance: (await wallet.getBalance()).toHexString(),
    })
    vm.stateManager.putAccount(bufferify(wallet.address), account, () => {})

    // Deploy contract to vm
    const bytecode = SimpleLinkedTransferApp.bytecode
    const deployTx = new Transaction({
      gasLimit: toBN(2000000).toHexString(),
      gasPrice: toBN(1).toHexString(),
      nonce: await getAccountNonce(vm, wallet.privateKey),
      data: bytecode,
    })
    deployTx.sign(bufferify(wallet.privateKey))
    const deploymentResult = await vm.runTx({ tx: deployTx })
    expect(deploymentResult.execResult.exceptionError).to.be.undefined

    const appDef = getAddress(hexlify(deploymentResult.createdAddress!))
    expect(appDef).to.be.eq(simpleLinkedTransferApp.address)

    // Execute on evm
    const actionTx = new Transaction({
      to: appDef,
      gasLimit: toBN(2000000).toHexString(),
      gasPrice: toBN(1).toHexString(),
      data: functionData,
      nonce: await getAccountNonce(vm, wallet.privateKey),
    })
    actionTx.sign(bufferify(wallet.privateKey))
    const actionResult = await vm.runTx({ tx: actionTx })
    expect(actionResult.execResult.exceptionError).to.be.undefined
    const vmEncoded = simpleLinkedTransferApp.interface.decodeFunctionResult(
      'applyAction',
      hexlify(actionResult.execResult.returnValue)
    )

    // Execute on contract
    const encoded = await simpleLinkedTransferApp.functions.applyAction(
      encodeState(state),
      encodeAction(action)
    )

    expect(encoded[0]).to.eq(vmEncoded[0])

    // Decode outputs
    const contractDecoded = decodeState(encoded[0])
    const vmDecoded = decodeState(vmEncoded[0])
    // Verify both values are the same once decoded
    expect(vmDecoded).to.containSubset(contractDecoded)
  })
})
