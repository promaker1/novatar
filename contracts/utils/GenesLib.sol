// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

library GenesLib {
    
    uint internal constant PROF_MASK = 0xFF000000000000000000000000;
    uint internal constant SEX_MASK = 0x000000000000000000000000FF;

    function setGeneLevelTo(uint genes, uint level, uint position) internal pure returns (uint) {
        return genes | uint(level << (position * 8));
    }

    function geneLevelAt(uint genes, uint position) internal pure returns (uint) {
        return (genes >> (position * 8)) & 0xFF;
    }

    function randomGeneLevel(uint randomValue, uint minLevel, uint maxLevel) internal pure returns (uint) {
        return minLevel + (randomValue % (maxLevel - minLevel));
    }

    function isGeneChangeable(uint position) internal pure returns (bool) {
        return position != 0; //0 - sex
    }

    /**
     * The special genes can accept any value (including zero) regardless avatar's age
     */
    function isGeneSpecial(uint position) internal pure returns (bool) {
        //2 - hairstyle, 8 - stubble/beard/mustache, 12 - profession
        return position == 2 || position == 8 || position == 12;
    }
    
}