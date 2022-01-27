const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Avatar Token", function () {
  let token;
  let market;
  let manager;
  let owner;
  let addr1;
  let addr2;

  let nonExistentTokenError;
  let notEnoughPrivilegesError;
  let badAddressError;
  let badAmountError;
  let supplyLimitError;
  let growUpOwnerError;
  let growUpTimeError;
  let growUpAdultError;
  let setAdultImageError;
  let collectionRevealedError;
  let collectionNotRevealedError;

  let ceoRole;
  let cooRole;
  let cfoRole;

  const defaultBabyUri = "ipfs://DEFAULT_BABY_CID";
  const totalSupply = 10;
  const growUpTime = 30 * 24 * 60 * 60;
  const priceOfGrowingUp = ethers.utils.parseEther("0.05");

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const accessControlManager = await ethers.getContractFactory(
      "AccessControlManager"
    );
    manager = await accessControlManager.deploy();
    await manager.deployed();

    ceoRole = await manager.CEO_ROLE.call();
    cooRole = await manager.COO_ROLE.call();
    cfoRole = await manager.CFO_ROLE.call();

    await manager.grantRole(ceoRole, owner.address);
    await manager.grantRole(cooRole, owner.address);
    await manager.grantRole(cfoRole, owner.address);

    const avatarToken = await ethers.getContractFactory("AvatarToken");

    token = await avatarToken.deploy(
      totalSupply,
      defaultBabyUri,
      growUpTime,
      priceOfGrowingUp,
      manager.address
    );
    await token.deployed();

    const avatarMarket = await ethers.getContractFactory("AvatarMarket");
    market = await avatarMarket.deploy(token.address, manager.address);
    await market.deployed();

    nonExistentTokenError = await token.NON_EXISTENT_TOKEN_ERROR.call();
    notEnoughPrivilegesError = await token.NOT_ENOUGH_PRIVILEGES_ERROR.call();
    badAddressError = await token.BAD_ADDRESS_ERROR.call();
    badAmountError = await token.BAD_AMOUNT_ERROR.call();
    supplyLimitError = await token.SUPPLY_LIMIT_ERROR.call();
    growUpOwnerError = await token.GROW_UP_OWNER_ERROR.call();
    growUpTimeError = await token.GROW_UP_TIME_ERROR.call();
    growUpAdultError = await token.GROW_UP_ADULT_ERROR.call();
    setAdultImageError = await token.SET_ADULT_IMAGE_ERROR.call();
    collectionRevealedError = await token.COLLECTION_REVEALED_ERROR.call();
    collectionNotRevealedError =
      await token.COLLECTION_NOT_REVEALED_ERROR.call();
  });

  it("Only a user with COO role can set a new avatar market address", async function () {
    await expect(
      token.connect(addr1).setAvatarMarketAddress(market.address)
    ).to.be.revertedWith(
      `AccessControl: account ${addr1.address
        .toString()
        .toLowerCase()} is missing role ${cooRole}`
    );
  });

  it("Only a user with COO role can set a new grow up time", async function () {
    await expect(
      token.connect(addr1).setGrowUpTime(100000000)
    ).to.be.revertedWith(
      `AccessControl: account ${addr1.address
        .toString()
        .toLowerCase()} is missing role ${cooRole}`
    );
  });

  it("Only a user with COO role can set a new default baby URI", async function () {
    await expect(
      token.connect(addr1).setDefaultBabyURI("ipfs://new_uri")
    ).to.be.revertedWith(
      `AccessControl: account ${addr1.address
        .toString()
        .toLowerCase()} is missing role ${cooRole}`
    );
  });

  it("Only a user with COO role can set a base URI and reveal the tokens", async function () {
    await expect(
      token.connect(addr1).setBaseURI("ipfs://base_uri")
    ).to.be.revertedWith(
      `AccessControl: account ${addr1.address
        .toString()
        .toLowerCase()} is missing role ${cooRole}`
    );
  });

  it("Only a user with COO role can set an adult image for the given token", async function () {
    await expect(token.connect(addr1).setAdultImage(1)).to.be.revertedWith(
      `AccessControl: account ${addr1.address
        .toString()
        .toLowerCase()} is missing role ${cooRole}`
    );
  });

  it("Only a user with COO role can pause the contract", async function () {
    await expect(token.connect(addr1).pause()).to.be.revertedWith(
      `AccessControl: account ${addr1.address
        .toString()
        .toLowerCase()} is missing role ${cooRole}`
    );
  });

  it("Only a user with COO role can unpause the contract", async function () {
    await expect(token.connect(addr1).unpause()).to.be.revertedWith(
      `AccessControl: account ${addr1.address
        .toString()
        .toLowerCase()} is missing role ${cooRole}`
    );
  });

  it("Only a user with CFO role can set a new price of growing up", async function () {
    await expect(
      token.connect(addr1).setPriceOfGrowingUp(10000000)
    ).to.be.revertedWith(
      `AccessControl: account ${addr1.address
        .toString()
        .toLowerCase()} is missing role ${cfoRole}`
    );
  });

  it("Only a user with CFO role can withdraw Ethers from the contract", async function () {
    await expect(
      token.connect(addr1).withdrawEthers(10000000, addr2.address)
    ).to.be.revertedWith(
      `AccessControl: account ${addr1.address
        .toString()
        .toLowerCase()} is missing role ${cfoRole}`
    );
  });

  it("Only a user with CEO role or the market contract can mint new avatars", async function () {
    await expect(token.connect(addr1).mint(addr1.address)).to.be.revertedWith(
      notEnoughPrivilegesError
    );
  });

  it("Unable to pass a regular account as a new market address", async function () {
    await expect(
      token.connect(owner).setAvatarMarketAddress(addr1.address)
    ).to.be.revertedWith(badAddressError);
  });

  it("Unable to set a base URI if the collection already revealed", async function () {
    const baseUri = "ipfs://base_avatar_uri/";
    await expect(token.connect(owner).setBaseURI(baseUri))
      .to.emit(token, "SetBaseURI")
      .withArgs(owner.address, baseUri);

    await expect(
      token.connect(owner).setBaseURI("ipfs://another_base_uri")
    ).to.be.revertedWith(collectionRevealedError);
  });

  it("Unable to mint a token to an account of contract type", async function () {
    await expect(token.connect(owner).mint(market.address)).to.be.revertedWith(
      badAddressError
    );
  });

  it("Unable to mint more tokens than the total supply specified", async function () {
    for (let i = 0; i < totalSupply; i++) {
      await expect(token.connect(owner).mint(addr1.address))
        .to.emit(token, "Transfer")
        .withArgs(ethers.constants.AddressZero, addr1.address, i + 1)
        .to.emit(token, "AvatarCreated")
        .withArgs(owner.address, addr1.address, i + 1);
    }
    await expect(token.connect(owner).mint(addr1.address)).to.be.revertedWith(
      supplyLimitError
    );
  });

  it("Unable to grow up a token if the collection is not revealed yet", async function () {
    await expect(token.connect(owner).mint(addr1.address))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(owner.address, addr1.address, 1);

    await expect(token.connect(addr1).growUp(1)).to.be.revertedWith(
      collectionNotRevealedError
    );
  });

  it("Unable to grow an avatar if the contract is paused", async function () {
    await expect(token.connect(owner).mint(addr1.address))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(owner.address, addr1.address, 1);
    await token.connect(owner).setBaseURI("ipfs://base_avatar_uri/");
    await token.connect(owner).pause();

    await expect(token.connect(addr1).growUp(1)).to.be.revertedWith(
      "Pausable: paused"
    );
  });

  it("Unable to grow an avatar if the time has not come yet", async function () {
    await expect(token.connect(owner).mint(addr1.address))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(owner.address, addr1.address, 1);
    await token.connect(owner).setBaseURI("ipfs://base_avatar_uri/");

    await expect(token.connect(addr1).growUp(1)).to.be.revertedWith(
      growUpTimeError
    );
  });

  it("Only the owner of a the given avatar can grow it up", async function () {
    await expect(token.connect(owner).mint(addr1.address))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(owner.address, addr1.address, 1);
    await token.connect(owner).setBaseURI("ipfs://base_avatar_uri/");

    await expect(token.connect(addr2).growUp(1)).to.be.revertedWith(
      growUpOwnerError
    );
  });

  it("Unable to grow a nonexistent avatar", async function () {
    await expect(token.connect(addr1).growUp(1), {
      value: priceOfGrowingUp,
    }).to.be.revertedWith(nonExistentTokenError);
  });

  it("Unable to grow an avatar up with wrong amount passed", async function () {
    await expect(token.connect(owner).mint(addr1.address))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(owner.address, addr1.address, 1);
    await token.connect(owner).setBaseURI("ipfs://base_avatar_uri/");

    await ethers.provider.send("evm_increaseTime", [growUpTime]); // added grow period
    await ethers.provider.send("evm_mine"); // force mine

    await expect(token.connect(addr1).growUp(1), {
      value: priceOfGrowingUp.sub(1),
    }).to.be.revertedWith(badAmountError);
  });

  it("Unable to grow the given avatar up more than once", async function () {
    await expect(token.connect(owner).mint(addr1.address))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(owner.address, addr1.address, 1);
    await token.connect(owner).setBaseURI("ipfs://base_avatar_uri/");

    await ethers.provider.send("evm_increaseTime", [growUpTime]); // added grow period
    await ethers.provider.send("evm_mine"); // force mine

    await expect(
      token.connect(addr1).growUp(1, {
        value: priceOfGrowingUp,
      })
    )
      .to.emit(token, "AvatarGrown")
      .withArgs(addr1.address, 1);

    await expect(token.connect(addr1).growUp(1)).to.be.revertedWith(
      growUpAdultError
    );
  });

  it("Unable to set an adult image if the given avatar is not grown yet", async function () {
    await expect(token.connect(owner).mint(addr1.address))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(owner.address, addr1.address, 1);

    await expect(token.connect(owner).setAdultImage(1)).to.be.revertedWith(
      setAdultImageError
    );
  });

  it("A new avatar can be minted. The default baby URI is returned.", async function () {
    await expect(token.connect(owner).mint(addr1.address))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(owner.address, addr1.address, 1);

    const avatar = await token.avatar(1);
    expect(avatar.grownAt).to.equal(0);
    expect(avatar.mintedAt).to.equal(
      (await ethers.provider.getBlock()).timestamp
    );
    // eslint-disable-next-line no-unused-expressions
    expect(avatar.hasAdultImage).to.be.false;
    expect(await token.tokenURI(1)).to.equal(defaultBabyUri);
  });

  it("The collection is revealed. The token URI returns a new value.", async function () {
    await expect(token.connect(owner).mint(addr1.address))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(owner.address, addr1.address, 1);

    expect(await token.tokenURI(1)).to.equal(defaultBabyUri);

    const baseUri = "ipfs://base_avatar_uri/";
    await token.connect(owner).setBaseURI(baseUri);

    expect(await token.tokenURI(1)).to.equal(`${baseUri}/baby/1.json`);
  });

  it("A token has been grown up. The token URI returns the default value temporary.", async function () {
    await expect(token.connect(owner).mint(addr1.address))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(owner.address, addr1.address, 1);

    const baseUri = "ipfs://base_avatar_uri/";
    await token.connect(owner).setBaseURI(baseUri);

    expect(await token.tokenURI(1)).to.equal(`${baseUri}/baby/1.json`);
    await ethers.provider.send("evm_increaseTime", [growUpTime]); // added grow period
    await ethers.provider.send("evm_mine"); // force mine

    await token.connect(addr1).growUp(1, { value: priceOfGrowingUp });
    expect(await token.tokenURI(1)).to.equal(`${baseUri}/adult/default.json`);

    const avatar = await token.avatar(1);
    expect(avatar.grownAt).to.equal(
      (await ethers.provider.getBlock()).timestamp
    );
    // eslint-disable-next-line no-unused-expressions
    expect(avatar.hasAdultImage).to.be.false;
  });

  it("An adult image has been set up for the given avatar. The token URI returns a new value.", async function () {
    await expect(token.connect(owner).mint(addr1.address))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(owner.address, addr1.address, 1);

    const baseUri = "ipfs://base_avatar_uri/";
    await token.connect(owner).setBaseURI(baseUri);

    await ethers.provider.send("evm_increaseTime", [growUpTime]); // added grow period
    await ethers.provider.send("evm_mine"); // force mine

    await token.connect(addr1).growUp(1, { value: priceOfGrowingUp });
    expect(await token.tokenURI(1)).to.equal(`${baseUri}/adult/default.json`);

    await expect(token.connect(owner).setAdultImage(1))
      .to.emit(token, "SetAdultImage")
      .withArgs(owner.address, 1);

    expect(await token.tokenURI(1)).to.equal(`${baseUri}/adult/1.json`);
    const avatar = await token.avatar(1);
    // eslint-disable-next-line no-unused-expressions
    expect(avatar.hasAdultImage).to.be.true;
  });
});
