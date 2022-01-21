// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "./access/BaseAccessControl.sol";
import "./structs/AvatarInfo.sol";

contract AvatarToken is ERC721, BaseAccessControl, Pausable {

    string public constant NON_EXISTENT_TOKEN_ERROR = "AvatarToken: nonexistent token";  
    string public constant NOT_ENOUGH_PRIVILEGES_ERROR = "AvatarToken: not enough privileges";
    string public constant BAD_ADDRESS_ERROR = "AvatarToken: bad address";
    string public constant BAD_AMOUNT_ERROR = "AvatarToken: bad amount";
    string public constant SUPPLY_LIMIT_ERROR = "AvatarToken: total supply has exceeded";
    string public constant GROW_UP_OWNER_ERROR = "AvatarToken: caller is not owner";
    string public constant GROW_UP_TIME_ERROR = "AvatarToken: it is not time to grow up";
    string public constant GROW_UP_ADULT_ERROR = "AvatarToken: already adult";  

    using Address for address payable;

    using Counters for Counters.Counter;
    using Address for address;
    using Strings for uint256;
      
    Counters.Counter private _avatarIds;

    address private _avatarMarketAddress;
    uint private _growTime; //in secs
    string private _baseCid;
    uint private _priceOfGrowingUp;
    uint private _totalTokenSupply;
    
    uint private _revealUpperBound;

    // Mapping token id to avatar details
    mapping(uint => uint) private _info;

    event AvatarCreated(address indexed operator, address indexed to, uint tokenId);
    event AvatarGrown(address indexed operator, uint tokenId);
    event SetAdultImage(address indexed operator, uint tokenId, bool value);
    event EthersWithdrawn(address operator, address indexed to, uint amount);

    constructor(
        uint totalSupply,
        string memory bCid,
        uint gt, uint price, 
        address accessControl) 
        ERC721("Baby-Adult Avatar", "BAA") 
        BaseAccessControl(accessControl) {

        _totalTokenSupply = totalSupply;
        _baseCid = bCid;
        _growTime = gt;
        _priceOfGrowingUp = price;
    }

    function totalTokenSupply() public view returns (uint) {
        return _totalTokenSupply;
    }

    function currentTokenCount() public view returns (uint) {
        return uint(_avatarIds.current());
    }

    function avatarMarketAddress() public view returns (address) {
        return _avatarMarketAddress;
    }

    function setAvatarMarketAddress(address newAddress) external onlyRole(CEO_ROLE) {
        require(newAddress.isContract(), BAD_ADDRESS_ERROR);

        address previousAddress = _avatarMarketAddress;
        _avatarMarketAddress = newAddress;
        emit AddressChanged("avatarMarket", previousAddress, newAddress);
    }

    function growUpTime() public view returns (uint) {
        return _growTime;
    }

    function setGrowUpTime(uint newValue) external onlyRole(COO_ROLE) {
        uint previousValue = _growTime;
        _growTime = newValue;
        emit ValueChanged("growUpTime", previousValue, newValue);
    }

    function priceOfGrowingUp() public view returns (uint) {
        return _priceOfGrowingUp;
    }

    function setPriceOfGrowingUp(uint newValue) external onlyRole(CFO_ROLE) {
        uint previousValue = _priceOfGrowingUp;
        _priceOfGrowingUp = newValue;
        emit ValueChanged("priceOfGrowingUp", previousValue, newValue);
    }

    function baseCid() public view returns (string memory) {
        return _baseCid;
    }

    function setBaseCid(string memory newValue) external onlyRole(COO_ROLE) {
        string memory previousValue = _baseCid;
        _baseCid = newValue;
        emit StringValueChanged("baseCid", previousValue, newValue);
    }

    function revealBabyAvatars(uint upperBound) external onlyRole(COO_ROLE) {
        uint previousValue = _revealUpperBound;
        _revealUpperBound = upperBound;
        emit ValueChanged("upperBound", previousValue, upperBound);
    }

    function setAdultImage(uint tokenId, bool value) external onlyRole(COO_ROLE) {
        require(_exists(tokenId), NON_EXISTENT_TOKEN_ERROR);
        
        AvatarInfo.Details memory details = AvatarInfo.getDetails(_info[tokenId]);
        details.hasAdultImage = value;
        _info[tokenId] = AvatarInfo.getValue(details);

        emit SetAdultImage(_msgSender(), tokenId, value);
    }

    function avatar(uint tokenId) external view returns (AvatarInfo.Details memory) {
        require(_exists(tokenId), NON_EXISTENT_TOKEN_ERROR);
        return AvatarInfo.getDetails(_info[tokenId]);
    }

    function hasAdultImage(uint tokenId) public view returns (bool) {
        require(_exists(tokenId), NON_EXISTENT_TOKEN_ERROR);
        AvatarInfo.Details memory details = AvatarInfo.getDetails(_info[tokenId]);
        return details.hasAdultImage;
    }

    function isAdult(uint tokenId) public view returns (bool) {
        require(_exists(tokenId), NON_EXISTENT_TOKEN_ERROR);
        AvatarInfo.Details memory details = AvatarInfo.getDetails(_info[tokenId]);
        return details.grownAt > 0;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), NON_EXISTENT_TOKEN_ERROR);
        AvatarInfo.Details memory details = AvatarInfo.getDetails(_info[tokenId]);
        string memory path = (details.grownAt > 0)
            ? string(
                abi.encodePacked(
                    baseCid(), 
                    "/adult/", 
                    details.hasAdultImage ? tokenId.toString() : "default", 
                    ".json"))
            : string(
                abi.encodePacked(
                    baseCid(), 
                    "/baby/", 
                    (tokenId <= _revealUpperBound) ? tokenId.toString() : "default",
                    ".json"));
        return string(abi.encodePacked("ipfs://", path));
    }

    function mint(address to) external returns (uint) {
        require(_msgSender() == avatarMarketAddress() || hasRole(CEO_ROLE, _msgSender()), NOT_ENOUGH_PRIVILEGES_ERROR);
        require(!to.isContract(), BAD_ADDRESS_ERROR);
        require(currentTokenCount() < totalTokenSupply(), SUPPLY_LIMIT_ERROR);
        
        _avatarIds.increment();
        uint newAvatarId = uint(_avatarIds.current());
        _info[newAvatarId] = AvatarInfo.getValue(AvatarInfo.Details({
            mintedAt: block.timestamp,
            grownAt: 0,
            hasAdultImage: false
        }));
        _mint(to, newAvatarId);

        emit AvatarCreated(_msgSender(), to, newAvatarId);
        return newAvatarId;
    }

    function growUp(uint tokenId) external payable whenNotPaused {
        require(_exists(tokenId), NON_EXISTENT_TOKEN_ERROR);
        require(ownerOf(tokenId) == _msgSender(), GROW_UP_OWNER_ERROR);
        AvatarInfo.Details memory details = AvatarInfo.getDetails(_info[tokenId]);
        require(details.grownAt == 0, GROW_UP_ADULT_ERROR);
        require(details.mintedAt + growUpTime() <= block.timestamp, GROW_UP_TIME_ERROR);
        require(msg.value >= priceOfGrowingUp(), BAD_AMOUNT_ERROR);
        
        details.grownAt = block.timestamp;
        _info[tokenId] = AvatarInfo.getValue(details);

        emit AvatarGrown(_msgSender(), tokenId);
    }

    function pause() external onlyRole(COO_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(COO_ROLE) {
        _unpause();
    }

    function withdrawEthers(uint amount, address payable to) external onlyRole(CFO_ROLE) {
        require(!to.isContract(), BAD_ADDRESS_ERROR);

        to.sendValue(amount);
        emit EthersWithdrawn(_msgSender(), to, amount);
    }
}