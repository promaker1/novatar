// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./structs/AvatarInfo.sol";
import "./utils/GenesLib.sol";
import "./utils/Random.sol";

contract BabyAdult is ERC721 {

    string public constant NON_EXISTENT_TOKEN_ERROR = "BabyAdult: nonexistent token";  
    string public constant BAD_ADDRESS_ERROR = "BabyAdult: bad address";
    string public constant BAD_GENES_ERROR = "BabyAdult: bad genes";
    string public constant GROW_UP_OWNER_ERROR = "BabyAdult: caller is not owner";
    string public constant GROW_UP_TIME_ERROR = "BabyAdult: it is not time to grow up";
    string public constant GROW_UP_ADULT_ERROR = "BabyAdult: already adult";  

    uint internal constant MAGIC_NUM = 0x123456789ABCDEF; 

    using Counters for Counters.Counter;
    using Address for address;
    using Strings for uint256;
      
    Counters.Counter private _avatarIds;

    string private _avatarBaseURI;
    mapping(uint => uint) private _genes;

    event AvatarCreated(address indexed caller, address indexed to, uint tokenId, uint genes, uint growTime);
    event AvatarGrown(address indexed caller, uint tokenId, uint oldGenes, uint newGenes);

    constructor(string memory avatarBaseURI) ERC721("Baby-Adult Avatar", "BAA") {
        _avatarBaseURI = avatarBaseURI;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), NON_EXISTENT_TOKEN_ERROR);
        AvatarInfo.Details memory details = AvatarInfo.getDetails(_genes[tokenId]);
        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 ? 
            string(abi.encodePacked(baseURI, tokenId.toString(), "/", details.genes.toString())) : "";
    }

    function _baseURI() internal view override returns (string memory) {
        return _avatarBaseURI;
    }

    function mint(uint genes_, uint growTime_, address to) external {
        require(!to.isContract(), BAD_ADDRESS_ERROR);
        require(genes_ & GenesLib.PROF_MASK == 0, BAD_GENES_ERROR);
        
        _checkGeneLevels(genes_, 1, 5);
        
        _avatarIds.increment();
        uint newAvatarId = uint(_avatarIds.current());
            
        _genes[newAvatarId] = AvatarInfo.getValue(AvatarInfo.Details({
            genes: genes_,
            growTime: growTime_,
            mintedAt: block.timestamp,
            grownAt: 0
        }));
        _mint(to, newAvatarId);

        emit AvatarCreated(_msgSender(), to, newAvatarId, genes_, growTime_);
    }

    function growUp(uint tokenId) external {
        require(_exists(tokenId), NON_EXISTENT_TOKEN_ERROR);
        require(ownerOf(tokenId) == _msgSender(), GROW_UP_OWNER_ERROR);
        AvatarInfo.Details memory details = AvatarInfo.getDetails(_genes[tokenId]);
        require(details.grownAt == 0, GROW_UP_ADULT_ERROR);
        require(details.mintedAt + details.growTime <= block.timestamp, GROW_UP_TIME_ERROR);
        
        uint oldGenes = details.genes;
        uint newGenes = _changeGenesRandomly(oldGenes, 6, 20);
        details.genes = newGenes;
        details.grownAt = block.timestamp;
        _genes[tokenId] = AvatarInfo.getValue(details);

        emit AvatarGrown(_msgSender(), tokenId, oldGenes, newGenes);
    }

    function avatar(uint tokenId) external view returns (AvatarInfo.Details memory) {
        require(_exists(tokenId), NON_EXISTENT_TOKEN_ERROR);
        return AvatarInfo.getDetails(_genes[tokenId]);
    }

    function isAdult(uint tokenId) external view returns (bool) {
        require(_exists(tokenId), NON_EXISTENT_TOKEN_ERROR);
        AvatarInfo.Details memory details = AvatarInfo.getDetails(_genes[tokenId]);
        return details.grownAt > 0;
    }

    function _changeGenesRandomly(uint genes, uint minLevel, uint maxLevel) internal view returns (uint) {
        uint randomValue = Random.rand(genes);
        for (uint pos = 0; pos < 13; pos++) {
            if (GenesLib.isGeneChangeable(pos)) {
                uint minL = minLevel;
                uint maxL = maxLevel;
                if (GenesLib.isGeneSpecial(pos)) {
                    minL = 0;
                    maxL = 20;
                }
                uint salt = (pos % 2 > 0) ? ((randomValue >> pos) + (MAGIC_NUM >> pos)) : ~(randomValue >> pos);
                uint newLevel = GenesLib.randomGeneLevel(salt, minL, maxL);
                genes = GenesLib.setGeneLevelTo(genes, newLevel, pos);
            }
        }
        return genes;
    }

    function _checkGeneLevels(uint genes, uint minLevel, uint maxLevel) internal pure {
        for(uint pos = 0; pos < 13; pos++) {
            if (GenesLib.isGeneChangeable(pos) && !GenesLib.isGeneSpecial(pos)) {
                uint level = GenesLib.geneLevelAt(genes, pos);
                if (level < minLevel || level > maxLevel)
                    revert(BAD_GENES_ERROR);
            }
        }
    }
}
