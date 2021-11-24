// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

library Random {
    function rand(uint salt) internal view returns (uint) {
        return uint(keccak256(abi.encodePacked(block.difficulty, block.timestamp, salt)));
    }
}