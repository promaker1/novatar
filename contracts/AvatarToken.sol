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
    string public constant NOT_ENOUGH_PRIVILEGES_ERROR = "AvatarToken: not enough privileges to call the method";
    string public constant CID_ALREADY_SET_ERROR = "AvatarToken: CID is already set";
    string public constant BAD_IPFS_CID_ERROR = "AvatarToken: bad CID";
    string public constant BAD_ADDRESS_ERROR = "AvatarToken: bad address";
    string public constant BAD_AMOUNT_ERROR = "AvatarToken: incorrect amount sent to the contract";
    string public constant SUPPLY_LIMIT_ERROR = "AvatarToken: total token supply has exceeded";
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
    string private _babyAvatarBaseCid;
    string private _defaultBabyCid;
    string private _defaultAdultCid;
    uint private _priceOfGrowingUp;
    uint private _totalTokenSupply;

    // Mapping token id to avatar details
    mapping(uint => uint) private _info;
    // Mapping token id to adult cid
    mapping(uint => string) private _adultCids;

    event AvatarCreated(address indexed caller, address indexed to, uint tokenId);
    event AvatarGrown(address indexed caller, uint tokenId);
    event EthersWithdrawn(address operator, address indexed to, uint amount);

    constructor(
        uint totalSupply,
        string memory defaultBabyCid, 
        string memory defaultAdultCid, 
        uint gt, uint price, 
        address accessControl) 
        ERC721("Baby-Adult Avatar", "BAA") 
        BaseAccessControl(accessControl) {

        _totalTokenSupply = totalSupply;
        _defaultBabyCid = defaultBabyCid;
        _defaultAdultCid = defaultAdultCid;
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

    function defaultBabyMetadataCid() public view returns (string memory) {
        return _defaultBabyCid;
    }

    function setDefaultBabyMetadataCid(string memory newValue) external onlyRole(COO_ROLE) {
        string memory previousValue = newValue;
        _defaultBabyCid = newValue;
        emit StringValueChanged("defaultBabyCid", previousValue, newValue);
    }

    function defaultAdultMetadataCid() public view returns (string memory) {
        return _defaultAdultCid;
    }

    function setDefaultAdultMetadataCid(string memory newValue) external onlyRole(COO_ROLE) {
        string memory previousValue = newValue;
        _defaultAdultCid = newValue;
        emit StringValueChanged("defaultAdultCid", previousValue, newValue);
    }

    function babyAvatarBaseCid() public view returns (string memory) {
        return _babyAvatarBaseCid;
    }

    function revealBabyAvatars(string calldata baseCid) external onlyRole(COO_ROLE) {
        string memory previousValue = _babyAvatarBaseCid;
        _babyAvatarBaseCid = baseCid;
        emit StringValueChanged("babyAvatarBaseCid", previousValue, baseCid);
    }

    function hasAdultMetadataCid(uint tokenId) public view returns (bool) {
        return bytes(_adultCids[tokenId]).length > 0;
    }

    function setAdultMetadataCid(uint tokenId, string memory cid) external onlyRole(COO_ROLE) {
        require(bytes(cid).length >= 46, BAD_IPFS_CID_ERROR);
        require(!hasAdultMetadataCid(tokenId), CID_ALREADY_SET_ERROR);

        string memory previousValue = _adultCids[tokenId];
        _adultCids[tokenId] = cid;
        emit StringValueChanged(string(abi.encodePacked("adultCids.", tokenId)), previousValue, cid);
    }

    function avatar(uint tokenId) external view returns (AvatarInfo.Details memory) {
        require(_exists(tokenId), NON_EXISTENT_TOKEN_ERROR);
        return AvatarInfo.getDetails(_info[tokenId]);
    }

    function isAdult(uint tokenId) public view returns (bool) {
        require(_exists(tokenId), NON_EXISTENT_TOKEN_ERROR);
        AvatarInfo.Details memory details = AvatarInfo.getDetails(_info[tokenId]);
        return details.grownAt > 0;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), NON_EXISTENT_TOKEN_ERROR);

        if (isAdult(tokenId)) {
            string memory cid = _adultCids[tokenId];
            return string(abi.encodePacked("ipfs://", (bytes(cid).length > 0) ? cid : defaultAdultMetadataCid()));
        }
        else if (bytes(babyAvatarBaseCid()).length > 0) {  //if revealed
            return string(abi.encodePacked("ipfs://", babyAvatarBaseCid(), "/", tokenId, ".json"));
        }
        else {
            return string(abi.encodePacked("ipfs://", defaultBabyMetadataCid()));
        }
    }

    function mint(address to) external returns (uint) {
        require(_msgSender() == avatarMarketAddress() || hasRole(CEO_ROLE, _msgSender()), NOT_ENOUGH_PRIVILEGES_ERROR);
        require(!to.isContract(), BAD_ADDRESS_ERROR);
        require(currentTokenCount() < totalTokenSupply(), SUPPLY_LIMIT_ERROR);
        
        _avatarIds.increment();
        uint newAvatarId = uint(_avatarIds.current());
        _info[newAvatarId] = AvatarInfo.getValue(AvatarInfo.Details({
            mintedAt: block.timestamp,
            grownAt: 0
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