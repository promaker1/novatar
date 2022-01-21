const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Avatar Token", function () {
  let token;
  let manager;
  let owner;
  let addr1;
  let addr2;

  let nonExistentTokenError;
  let badAddressError;
  let badGenesError;
  let growUpOwnerError;
  let growUpTimeError;
  let growUpAdultError;

  let ceoRole;
  let cooRole;
  let cfoRole;

  const baseCid = "DEFAULT_CID";

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
    const totalSupply = 10;
    const growUpTime = 30 * 24 * 60 * 60;
    const priceOfGrowingUp = ethers.utils.parseEther("0.05");

    token = await avatarToken.deploy(
      totalSupply,
      baseCid,
      growUpTime,
      priceOfGrowingUp,
      manager.address
    );
    await token.deployed();

    nonExistentTokenError = await token.NON_EXISTENT_TOKEN_ERROR.call();
    badAddressError = await token.BAD_ADDRESS_ERROR.call();
    badGenesError = await token.BAD_GENES_ERROR.call();
    growUpOwnerError = await token.GROW_UP_OWNER_ERROR.call();
    growUpTimeError = await token.GROW_UP_TIME_ERROR.call();
    growUpAdultError = await token.GROW_UP_ADULT_ERROR.call();
  });

  it("Unable to mint a token to a contract address", async function () {
    const genes = ethers.BigNumber.from("0x00010203040504030201010200");
    const growTime = 3600 * 24; // 1 day
    await expect(
      token.connect(addr1).mint(genes, growTime, token.address)
    ).to.be.revertedWith(badAddressError);
  });

  it("Unable to mint a token with the professional gene specified", async function () {
    const genes = ethers.BigNumber.from("0x02010203040504030201010200");
    const growTime = 3600 * 24; // 1 day
    await expect(
      token.connect(addr1).mint(genes, growTime, addr2.address)
    ).to.be.revertedWith(badGenesError);
  });

  it("Unable to mint a token with wrong gene levels", async function () {
    const genes1 = ethers.BigNumber.from("0x00010101000101010101000600");
    const genes2 = ethers.BigNumber.from("0x00010101000101010106000100");
    const genes3 = ethers.BigNumber.from("0x00010101000101010601000100");
    const genes4 = ethers.BigNumber.from("0x00010101000101060101000100");
    const genes5 = ethers.BigNumber.from("0x00010101000106010101000100");
    const genes6 = ethers.BigNumber.from("0x00010101000001010101000100");
    const genes7 = ethers.BigNumber.from("0x00010100000101010101000100");
    const genes8 = ethers.BigNumber.from("0x00010001000101010101000100");
    const genes9 = ethers.BigNumber.from("0x00000101000101010101000100");
    const growTime = 3600 * 24; // 1 day
    await expect(
      token.connect(addr1).mint(genes1, growTime, addr2.address)
    ).to.be.revertedWith(badGenesError);
    await expect(
      token.connect(addr1).mint(genes2, growTime, addr2.address)
    ).to.be.revertedWith(badGenesError);
    await expect(
      token.connect(addr1).mint(genes3, growTime, addr2.address)
    ).to.be.revertedWith(badGenesError);
    await expect(
      token.connect(addr1).mint(genes4, growTime, addr2.address)
    ).to.be.revertedWith(badGenesError);
    await expect(
      token.connect(addr1).mint(genes5, growTime, addr2.address)
    ).to.be.revertedWith(badGenesError);
    await expect(
      token.connect(addr1).mint(genes6, growTime, addr2.address)
    ).to.be.revertedWith(badGenesError);
    await expect(
      token.connect(addr1).mint(genes7, growTime, addr2.address)
    ).to.be.revertedWith(badGenesError);
    await expect(
      token.connect(addr1).mint(genes8, growTime, addr2.address)
    ).to.be.revertedWith(badGenesError);
    await expect(
      token.connect(addr1).mint(genes9, growTime, addr2.address)
    ).to.be.revertedWith(badGenesError);
  });

  it("Only owner can grow up a token", async function () {
    const genes = ethers.BigNumber.from("0x00010203040504030201010200");
    const growTime = 3600 * 24; // 1 day
    expect(await token.connect(addr1).mint(genes, growTime, addr2.address))
      .to.emit(token, "AvatarCreated")
      .withArgs(addr1.address, addr2.address, 1, genes, growTime);
    await expect(token.connect(addr1).growUp(1)).to.be.revertedWith(
      growUpOwnerError
    );
  });

  it("Unable to grow up a token if it is not right time", async function () {
    const genes = ethers.BigNumber.from("0x00010203040504030201010200");
    const growTime = 3600 * 24; // 1 day
    expect(await token.connect(addr1).mint(genes, growTime, addr2.address))
      .to.emit(token, "AvatarCreated")
      .withArgs(addr1.address, addr2.address, 1, genes, growTime);
    await expect(token.connect(addr2).growUp(1)).to.be.revertedWith(
      growUpTimeError
    );
  });

  it("Unable to grow up a token if it is already adult", async function () {
    const genes = ethers.BigNumber.from("0x00010203040504030201010200");
    const growTime = 0; // 1 day
    expect(await token.connect(addr1).mint(genes, growTime, addr2.address))
      .to.emit(token, "AvatarCreated")
      .withArgs(addr1.address, addr2.address, 1, genes, growTime);
    expect(await token.connect(addr2).growUp(1)).to.emit(token, "AvatarGrown");
    await expect(token.connect(addr2).growUp(1)).to.be.revertedWith(
      growUpAdultError
    );
  });

  it("Unable to request URI for a non existent token", async function () {
    await expect(token.connect(addr1).tokenURI(1)).to.be.revertedWith(
      nonExistentTokenError
    );
  });

  it("Unable to request avatar details for a non existent token", async function () {
    await expect(token.connect(addr1).avatar(1)).to.be.revertedWith(
      nonExistentTokenError
    );
  });

  it("A user can mint a token and request the URI and avatar details", async function () {
    const genes = ethers.BigNumber.from("0x00010203040504030201010200");
    const growTime = 3600 * 24; // 1 day
    expect(await token.connect(addr1).mint(genes, growTime, addr2.address))
      .to.emit(token, "AvatarCreated")
      .withArgs(addr1.address, addr2.address, 1, genes, growTime);
    const ts = (await ethers.provider.getBlock()).timestamp;
    expect(await token.isAdult(1)).to.equal(false);
    expect(await token.tokenURI(1)).to.equal(`${avatarBaseUri}1/${genes}`);
    const avatarDetails = await token.avatar(1);
    expect(avatarDetails.genes).to.equal(genes);
    expect(avatarDetails.growTime).to.equal(growTime);
    expect(avatarDetails.mintedAt).to.equal(ts);
    expect(avatarDetails.grownAt).to.equal(0);
  });

  it("An owner can grow its token and request the URI and avatar details", async function () {
    const genes = ethers.BigNumber.from("0x00010203040504030201010201");
    const growTime = 3600 * 24; // 1 day
    expect(await token.connect(addr1).mint(genes, growTime, addr2.address))
      .to.emit(token, "AvatarCreated")
      .withArgs(addr1.address, addr2.address, 1, genes, growTime);
    const mts = (await ethers.provider.getBlock()).timestamp;

    await ethers.provider.send("evm_increaseTime", [growTime]); // added grow period
    await ethers.provider.send("evm_mine"); // force mine

    expect(await token.connect(addr2).growUp(1)).to.emit(token, "AvatarGrown");
    const gts = (await ethers.provider.getBlock()).timestamp;

    expect(await token.isAdult(1)).to.equal(true);
    const avatarDetails = await token.avatar(1);
    expect(await token.tokenURI(1)).to.equal(
      `${avatarBaseUri}1/${avatarDetails.genes}`
    );
    expect(avatarDetails.genes).to.not.equal(genes);
    expect(avatarDetails.growTime).to.equal(growTime);
    expect(avatarDetails.mintedAt).to.equal(mts);
    expect(avatarDetails.grownAt).to.equal(gts);

    console.log(`Baby genes: ${genes.toHexString()}`);
    console.log(`Adult genes: ${avatarDetails.genes.toHexString()}`);
  });
});
