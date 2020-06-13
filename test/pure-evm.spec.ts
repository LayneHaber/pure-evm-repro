import { Contract, ContractFactory, Wallet } from "ethers";
const pure_evm = require("pure-evm-wasm");

// Get artifacts
import SimpleLinkedTransferApp from "../artifacts/SimpleLinkedTransferApp.json";
import SimpleRecover from "../artifacts/SimpleRecover.json";
import {
  getSimpleLinkedTransferInfo,
  encodeState,
  encodeAction,
  decodeState,
  provider,
  expect,
} from "./utils";
import {
  defaultAbiCoder,
  randomBytes,
  hexlify,
  SigningKey,
  joinSignature,
} from "ethers/lib/utils";

describe("Pure evm with view function", () => {
  let simpleLinkedTransferApp: Contract;
  let simpleRecover: Contract;

  // Constants
  let wallet: Wallet;
  let formatted;
  let functionData;
  let state;
  let action;

  beforeEach(async () => {
    // Deploy linked contract
    wallet = (await provider.getWallets())[0];
    const deploy = await new ContractFactory(
      SimpleLinkedTransferApp.abi,
      SimpleLinkedTransferApp.bytecode,
      wallet
    ).deploy();
    simpleLinkedTransferApp = await deploy.deployed();

    // Deploy recover contract
    const recover = await new ContractFactory(
      SimpleRecover.abi,
      SimpleRecover.bytecode,
      wallet
    ).deploy();
    simpleRecover = await recover.deployed();

    // Setup test constants
    const res = getSimpleLinkedTransferInfo();
    state = res.state;
    action = res.action;

    // Get the function data
    functionData = simpleLinkedTransferApp.interface.encodeFunctionData(
      "applyAction",
      [encodeState(state), encodeAction(action)]
    );

    // Format for evm execution
    formatted = Uint8Array.from(
      Buffer.from(functionData.replace("0x", ""), "hex")
    );
  });

  it("should fetch the deployed bytecode using rpc call", async () => {
    // Verify rpc will return bytecode
    const bytecode = await provider.send("eth_getCode", [
      simpleLinkedTransferApp.address,
      "latest",
    ]);
    expect(bytecode).to.equal(SimpleLinkedTransferApp.deployedBytecode);
  });

  it("returns deployed bytecode if executed using init code", async () => {
    // Execute on evm, decode output
    const output = pure_evm.exec(
      Uint8Array.from(
        Buffer.from(SimpleLinkedTransferApp.bytecode.replace("0x", ""), "hex")
      ),
      formatted
    );
    const outputHex = "0x" + Buffer.from(output).toString("hex");
    expect(outputHex).to.be.eq(SimpleLinkedTransferApp.deployedBytecode);
  });

  it("should be able to call hash function using pure-evm", async () => {
    let functionData = simpleLinkedTransferApp.interface.encodeFunctionData(
      "hash",
      ["0x11111111111111111111111111111111"]
    );
    let input = Uint8Array.from(
      Buffer.from(functionData.replace("0x", ""), "hex")
    );

    // Execute on evm, decode output
    const output = pure_evm.exec(
      Uint8Array.from(
        Buffer.from(
          SimpleLinkedTransferApp.deployedBytecode.replace("0x", ""),
          "hex"
        )
      ),
      input
    );

    expect(Buffer.from(output).toString("hex")).to.equal(
      "b8f12ea8c9a95d4b4641b03d9fa5a71ad30b44ed6cd4bf793bbe1a5801b986d4"
    );
  });

  it("should be able to call applyAction using pure-evm", async () => {
    // Execute on evm, decode output
    const output = pure_evm.exec(
      Uint8Array.from(
        Buffer.from(
          SimpleLinkedTransferApp.deployedBytecode.replace("0x", ""),
          "hex"
        )
      ),
      formatted
    );

    let outputValues = simpleLinkedTransferApp.interface.decodeFunctionResult(
      "applyAction",
      output
    );
    const evmDecoded = decodeState(outputValues[0]);

    // Execute on contract, decode output
    const encoded = await simpleLinkedTransferApp.functions.applyAction(
      encodeState(state),
      encodeAction(action)
    );
    const contractDecoded = decodeState(encoded[0]);

    // Verify both values are the same once decoded
    expect(evmDecoded).to.containSubset(contractDecoded);
  });

  it.only("should be able to call the ECDSA.recover function from pure-evm", async () => {
    // Execute on evm, decode output
    const digest = hexlify(randomBytes(32));
    const key = new SigningKey(wallet.privateKey);
    const sig = joinSignature(key.signDigest(digest));
    const functionData = simpleRecover.interface.encodeFunctionData("recover", [
      sig,
      digest,
    ]);
    const output = pure_evm.exec(
      Uint8Array.from(
        Buffer.from(
          SimpleLinkedTransferApp.deployedBytecode.replace("0x", ""),
          "hex"
        )
      ),
      Uint8Array.from(Buffer.from(functionData.replace("0x", ""), "hex"))
    );
    const bytes = defaultAbiCoder.decode(["bytes"], output)[0];
    const evmDecoded = defaultAbiCoder.decode(["address"], bytes);

    // Execute on contract, decode output
    const [addr] = await simpleRecover.functions.recover(sig, digest);

    // Verify both values are the same once decoded
    expect(addr).to.be.eq(wallet.address);
    expect(addr).to.be.eq(evmDecoded);
  });
});
