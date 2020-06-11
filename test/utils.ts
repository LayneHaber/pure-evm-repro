// @ts-ignore
import { waffle as buidler } from "@nomiclabs/buidler";
import { solidity } from "ethereum-waffle";
import { use } from "chai";
import { utils, constants } from "ethers";
const { One, Zero, HashZero } = constants;
const { defaultAbiCoder, hexlify, randomBytes, soliditySha256 } = utils;

// Setup assertions
use(require("chai-subset"));
export const expect = use(solidity).expect;

export const provider = buidler.provider;

export type CoinTransfer = {};
const coinTransferEncoding = `tuple(address to, uint256 amount)[2]`;

export type SimpleLinkedTransferAppState = {
  coinTransfers: CoinTransfer[];
  linkedHash: string;
  preImage: string;
  finalized: boolean;
};

export type SimpleLinkedTransferAppAction = {
  preImage: string;
};

export const stateEncoding = `tuple(${coinTransferEncoding} coinTransfers, bytes32 linkedHash, bytes32 preImage, bool finalized)`;

export const actionEncoding = `tuple(bytes32 preImage)`;

export const decodeState = (encoded: string) => {
  return defaultAbiCoder.decode([stateEncoding], encoded)[0];
};

export const decodeAction = (encoded: string) => {
  return defaultAbiCoder.decode([actionEncoding], encoded)[0];
};

export const encodeState = (state: SimpleLinkedTransferAppState): string => {
  return defaultAbiCoder.encode([stateEncoding], [state]);
};

export const encodeAction = (action: SimpleLinkedTransferAppAction): string => {
  return defaultAbiCoder.encode([actionEncoding], [action]);
};

export const getSimpleLinkedTransferInfo = (): {
  state: SimpleLinkedTransferAppState;
  action: SimpleLinkedTransferAppAction;
} => {
  const preImage = hexlify(randomBytes(32));
  const linkedHash = soliditySha256(["bytes32"], [preImage]);
  const state = {
    linkedHash,
    preImage: HashZero,
    finalized: false,
    coinTransfers: [
      {
        // buidler acct[0]
        to: "0xebb77dCE22ae0f9003359B7f7fe7b7eA0034529d",
        amount: One,
      },
      {
        // buidler acct[1]
        to: "0xbBFeca66860d78Eb9d037B0F9F6093025EF096A3",
        amount: Zero,
      },
    ],
  };
  const action = { preImage };
  return { state, action };
};
