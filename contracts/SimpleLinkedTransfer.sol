// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.4;
pragma experimental "ABIEncoderV2";

import "@openzeppelin/contracts/math/SafeMath.sol";


/// @title Simple Linked Transfer App
/// @notice This contract allows users to claim a payment locked in
///         the application if they provide the correct preImage
contract SimpleLinkedTransferApp {
    using SafeMath for uint256;

    struct CoinTransfer {
        address payable to;
        uint256 amount;
    }

    struct AppState {
        CoinTransfer[2] coinTransfers;
        bytes32 linkedHash;
        bytes32 preImage;
        bool finalized;
    }

    struct Action {
        bytes32 preImage;
    }

    function applyAction(
        bytes calldata encodedState,
        bytes calldata encodedAction
    ) external view returns (bytes memory) {
        AppState memory state = abi.decode(encodedState, (AppState));
        Action memory action = abi.decode(encodedAction, (Action));
        bytes32 generatedHash = sha256(abi.encode(action.preImage));

        require(!state.finalized, "Cannot take action on finalized state");
        require(
            state.linkedHash == generatedHash,
            "Hash generated from preimage does not match hash in state"
        );

        state.coinTransfers[1].amount = state.coinTransfers[0].amount;
        state.coinTransfers[0].amount = 0;
        state.preImage = action.preImage;
        state.finalized = true;

        return abi.encode(state);
    }
}
