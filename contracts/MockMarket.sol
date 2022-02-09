// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;
import "./AvatarToken.sol";

contract MockMarket {
    
    address private _tokenAddress;

    constructor(address avatarToken) {
        _tokenAddress = avatarToken;
    }

    function buy(address to, uint count) external {
        AvatarToken at = AvatarToken(_tokenAddress);
        
        for (uint i = 0; i < count; i++) {
            at.mint(to);
        }
    }
}