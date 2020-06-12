pragma solidity ^0.6.4;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";

contract SimpleRecover {
    function recover(bytes memory signature, bytes32 digest)
        public
        pure
        returns (address)
    {
        return ECDSA.recover(digest, signature);
    }
}
