// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

library AvatarInfo {

    struct Details { 
        uint genes;
        uint growTime;
        uint mintedAt;
        uint grownAt;
    }

    function getDetails(uint value) internal pure returns (Details memory) {
        return Details (
            {
                genes: uint256(uint96(value)),
                growTime: uint256(uint32(value >> 104)),
                mintedAt: uint256(uint64(value >> 136)),
                grownAt: uint256(uint64(value >> 200))
            }
        );
    }

    function getValue(Details memory details) internal pure returns (uint) {
        uint result = uint(details.genes);
        result |= uint(details.growTime) << 104;
        result |= uint(details.mintedAt) << 136;
        result |= uint(details.grownAt) << 200;
        return result;
    }
}