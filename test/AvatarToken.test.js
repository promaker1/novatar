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
  let badCidError;
  let cidSetError;
  let supplyLimitError;
  let growUpOwnerError;
  let growUpTimeError;
  let growUpAdultError;
  let setAdultImageError;
  let collectionRevealedError;
  let collectionNotRevealedError;

  let cooRole;
  let cfoRole;

  const defaultBabyUri = "ipfs://DEFAULT_BABY_CID";
  const defaultAdultCid = "DEFAULT_ADULT_CID";
  const totalSupply = 10;
  const growUpTime = 30 * 24 * 60 * 60;
  const priceOfGrowingUp = ethers.utils.parseEther("0.05");

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const accessControlManager = await ethers.getContractFactory(
      "AccessControlManager"
    );
    manager = await accessControlManager.deploy(
      owner.address,
      owner.address,
      owner.address,
      owner.address
    );
    await manager.deployed();

    cooRole = await manager.COO_ROLE.call();
    cfoRole = await manager.CFO_ROLE.call();

    const avatarToken = await ethers.getContractFactory("AvatarToken");

    token = await avatarToken.deploy(
      totalSupply,
      defaultBabyUri,
      defaultAdultCid,
      growUpTime,
      priceOfGrowingUp,
      manager.address
    );
    await token.deployed();

    const mockMarket = await ethers.getContractFactory("MockMarket");
    market = await mockMarket.deploy(token.address);
    await market.deployed();

    nonExistentTokenError = await token.NON_EXISTENT_TOKEN_ERROR.call();
    notEnoughPrivilegesError = await token.NOT_ENOUGH_PRIVILEGES_ERROR.call();
    badAddressError = await token.BAD_ADDRESS_ERROR.call();
    badAmountError = await token.BAD_AMOUNT_ERROR.call();
    badCidError = await token.BAD_CID_ERROR.call();
    cidSetError = await token.CID_SET_ERROR.call();
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

  it("Only a user with COO role can set a new base URI", async function () {
    await token.connect(owner).revealBabyAvatars("ipfs://base_avatar_uri/");
    await expect(
      token.connect(addr1).setBaseURI("ipfs://new_uri")
    ).to.be.revertedWith(
      `AccessControl: account ${addr1.address
        .toString()
        .toLowerCase()} is missing role ${cooRole}`
    );
  });

  it("Unable to set a new base URI for the collection if it is non revealed", async function () {
    await expect(
      token.connect(owner).setBaseURI("ipfs://new_uri")
    ).to.be.revertedWith(collectionNotRevealedError);
  });

  it("Only a user with COO role can set a base URI and reveal the tokens", async function () {
    await expect(
      token.connect(addr1).revealBabyAvatars("ipfs://base_uri")
    ).to.be.revertedWith(
      `AccessControl: account ${addr1.address
        .toString()
        .toLowerCase()} is missing role ${cooRole}`
    );
  });

  it("Only a user with COO role can set an adult image for the given token", async function () {
    await expect(
      token.connect(addr1).setAdultImage(1, "token_adult_cid")
    ).to.be.revertedWith(
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

  it("Cannot set a CID with a length of less than 46 symbols", async function () {
    await token.setAvatarMarketAddress(market.address);
    await market.connect(addr1).buy(addr1.address, 1);

    await token.connect(owner).revealBabyAvatars("ipfs://base_avatar_uri/");

    await ethers.provider.send("evm_increaseTime", [growUpTime]); // added grow period
    await ethers.provider.send("evm_mine"); // force mine

    await token.connect(addr1).growUp(1, {
      value: priceOfGrowingUp,
    });

    await expect(
      token.connect(owner).setAdultImage(1, "token_adult_cid")
    ).to.be.revertedWith(badCidError);
  });

  it("Unable to set a CID for an adult avatar more than once", async function () {
    await token.setAvatarMarketAddress(market.address);
    await market.connect(addr1).buy(addr1.address, 1);

    await token.connect(owner).revealBabyAvatars("ipfs://base_avatar_uri/");

    await ethers.provider.send("evm_increaseTime", [growUpTime]); // added grow period
    await ethers.provider.send("evm_mine"); // force mine

    await token.connect(addr1).growUp(1, {
      value: priceOfGrowingUp,
    });

    await expect(
      token
        .connect(owner)
        .setAdultImage(1, "QmNRCQWfgze6AbBCaT1rkrkV5tJ2aP4oTNPb5JZcXYywve")
    )
      .to.emit(token, "SetAdultImage")
      .withArgs(owner.address, 1);

    await expect(
      token
        .connect(owner)
        .setAdultImage(1, "QmNRCQWfgze6AbBCaT1rkrkV5tJ2aP4oTNPb5JZcXYywva")
    ).to.be.revertedWith(cidSetError);
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

  it("Only the market contract can invoke minting of new avatars", async function () {
    await expect(
      market.connect(addr1).buy(addr1.address, 1)
    ).to.be.revertedWith(notEnoughPrivilegesError);
  });

  it("Unable to pass a regular account as a new market address", async function () {
    await expect(
      token.connect(owner).setAvatarMarketAddress(addr1.address)
    ).to.be.revertedWith(badAddressError);
  });

  it("The collection can be revealed only once", async function () {
    const baseUri = "ipfs://base_avatar_uri/";
    await expect(token.connect(owner).revealBabyAvatars(baseUri))
      .to.emit(token, "Revealed")
      .withArgs(owner.address, baseUri);

    await expect(
      token.connect(owner).revealBabyAvatars("ipfs://another_base_uri")
    ).to.be.revertedWith(collectionRevealedError);
  });
  it("Unable to mint a token to an account of contract type", async function () {
    await token.setAvatarMarketAddress(market.address);
    await expect(
      market.connect(addr1).buy(market.address, 1)
    ).to.be.revertedWith(badAddressError);
  });
  it("Unable to mint more tokens than the total supply specified", async function () {
    await token.setAvatarMarketAddress(market.address);
    for (let i = 0; i < totalSupply; i++) {
      await expect(market.connect(addr1).buy(addr1.address, 1))
        .to.emit(token, "Transfer")
        .withArgs(ethers.constants.AddressZero, addr1.address, i + 1)
        .to.emit(token, "AvatarCreated")
        .withArgs(market.address, addr1.address, i + 1);
    }
    await expect(
      market.connect(addr1).buy(addr1.address, 1)
    ).to.be.revertedWith(supplyLimitError);
  });

  it("Unable to grow up a token if the collection is not revealed yet", async function () {
    await token.setAvatarMarketAddress(market.address);
    await expect(market.connect(addr1).buy(addr1.address, 1))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(market.address, addr1.address, 1);

    await expect(token.connect(addr1).growUp(1)).to.be.revertedWith(
      collectionNotRevealedError
    );
  });

  it("Unable to grow an avatar if the contract is paused", async function () {
    await token.setAvatarMarketAddress(market.address);
    await expect(market.connect(addr1).buy(addr1.address, 1))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(market.address, addr1.address, 1);
    await token.connect(owner).revealBabyAvatars("ipfs://base_avatar_uri/");
    await token.connect(owner).pause();

    await expect(token.connect(addr1).growUp(1)).to.be.revertedWith(
      "Pausable: paused"
    );
  });

  it("Unable to grow an avatar if the time has not come yet", async function () {
    await token.setAvatarMarketAddress(market.address);
    await expect(market.connect(addr1).buy(addr1.address, 1))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(market.address, addr1.address, 1);
    await token.connect(owner).revealBabyAvatars("ipfs://base_avatar_uri/");

    await expect(token.connect(addr1).growUp(1)).to.be.revertedWith(
      growUpTimeError
    );
  });

  it("Only the owner of a the given avatar can grow it up", async function () {
    await token.setAvatarMarketAddress(market.address);
    await expect(market.connect(addr1).buy(addr1.address, 1))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(market.address, addr1.address, 1);
    await token.connect(owner).revealBabyAvatars("ipfs://base_avatar_uri/");

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
    await token.setAvatarMarketAddress(market.address);
    await expect(market.connect(addr1).buy(addr1.address, 1))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(market.address, addr1.address, 1);
    await token.connect(owner).revealBabyAvatars("ipfs://base_avatar_uri/");

    await ethers.provider.send("evm_increaseTime", [growUpTime]); // added grow period
    await ethers.provider.send("evm_mine"); // force mine

    await expect(token.connect(addr1).growUp(1), {
      value: priceOfGrowingUp.sub(1),
    }).to.be.revertedWith(badAmountError);
  });

  it("Unable to grow the given avatar up more than once", async function () {
    await token.setAvatarMarketAddress(market.address);
    await expect(market.connect(addr1).buy(addr1.address, 1))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(market.address, addr1.address, 1);
    await token.connect(owner).revealBabyAvatars("ipfs://base_avatar_uri/");

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
    await token.setAvatarMarketAddress(market.address);
    await expect(market.connect(addr1).buy(addr1.address, 1))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(market.address, addr1.address, 1);

    await expect(
      token.connect(owner).setAdultImage(1, "new_adult_cid")
    ).to.be.revertedWith(setAdultImageError);
  });

  it("A new avatar can be minted. The default baby URI is returned.", async function () {
    await token.setAvatarMarketAddress(market.address);
    await expect(market.connect(addr1).buy(addr1.address, 1))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(market.address, addr1.address, 1);

    const avatar = await token.avatar(1);
    expect(avatar.grownAt).to.equal(0);
    expect(avatar.mintedAt).to.equal(
      (await ethers.provider.getBlock()).timestamp
    );
    // eslint-disable-next-line no-unused-expressions
    expect(await token.hasAdultImage(1)).to.be.false;
    expect(await token.tokenURI(1)).to.equal(defaultBabyUri);
  });

  it("The collection is revealed. The token URI returns a new value.", async function () {
    await token.setAvatarMarketAddress(market.address);
    await expect(market.connect(addr1).buy(addr1.address, 1))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(market.address, addr1.address, 1);

    expect(await token.tokenURI(1)).to.equal(defaultBabyUri);

    const baseUri = "ipfs://base_avatar_uri";
    await token.connect(owner).revealBabyAvatars(baseUri);

    expect(await token.tokenURI(1)).to.equal(`${baseUri}/1.json`);

    const newBaseUri = "ipfs://new_base_avatar_uri";
    await token.connect(owner).setBaseURI(newBaseUri);

    expect(await token.tokenURI(1)).to.equal(`${newBaseUri}/1.json`);
  });

  it("A token has been grown up. The token URI returns the default value temporary.", async function () {
    await token.setAvatarMarketAddress(market.address);
    await expect(market.connect(addr1).buy(addr1.address, 1))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(market.address, addr1.address, 1);

    const baseUri = "ipfs://base_avatar_uri";
    await token.connect(owner).revealBabyAvatars(baseUri);

    expect(await token.tokenURI(1)).to.equal(`${baseUri}/1.json`);
    await ethers.provider.send("evm_increaseTime", [growUpTime]); // added grow period
    await ethers.provider.send("evm_mine"); // force mine

    await token.connect(addr1).growUp(1, { value: priceOfGrowingUp });
    expect(await token.tokenURI(1)).to.equal(`ipfs://${defaultAdultCid}`);

    const avatar = await token.avatar(1);
    expect(avatar.grownAt).to.equal(
      (await ethers.provider.getBlock()).timestamp
    );
    // eslint-disable-next-line no-unused-expressions
    expect(await token.hasAdultImage(1)).to.be.false;
  });

  it("An adult image has been set up for the given avatar. The token URI returns a new value.", async function () {
    await token.setAvatarMarketAddress(market.address);
    await expect(market.connect(addr1).buy(addr1.address, 1))
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "AvatarCreated")
      .withArgs(market.address, addr1.address, 1);

    const baseUri = "ipfs://base_avatar_uri/";
    await token.connect(owner).revealBabyAvatars(baseUri);

    await ethers.provider.send("evm_increaseTime", [growUpTime]); // added grow period
    await ethers.provider.send("evm_mine"); // force mine

    await token.connect(addr1).growUp(1, { value: priceOfGrowingUp });
    expect(await token.tokenURI(1)).to.equal(`ipfs://${defaultAdultCid}`);

    const newCid = "QmNRCQWfgze6AbBCaT1rkrkV5tJ2aP4oTNPb5JZcXYywve";
    await expect(token.connect(owner).setAdultImage(1, newCid))
      .to.emit(token, "SetAdultImage")
      .withArgs(owner.address, 1);

    expect(await token.tokenURI(1)).to.equal(`ipfs://${newCid}`);
    // eslint-disable-next-line no-unused-expressions
    expect(await token.hasAdultImage(1)).to.be.true;
  });
});
