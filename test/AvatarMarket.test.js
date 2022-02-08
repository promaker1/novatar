const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Avatar Market", function () {
  let manager;
  let token;
  let market;
  let owner;
  let addr1;
  let addr2;
  let addr3;

  let badAddressError;
  let badCountError;
  let badAmountError;
  let totalSupplyError;
  let allowPresaleError;
  let presaleCountTotalLimitError;
  let presaleCountUserLimitError;
  let claimError;

  let ceoRole;
  let cooRole;
  let cfoRole;

  const defaultBabyUri = "http://DEFAULT_BABY_CID";

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

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
      defaultBabyUri,
      growUpTime,
      priceOfGrowingUp,
      manager.address,
      false
    );
    await token.deployed();

    const avatarMarket = await ethers.getContractFactory("AvatarMarket");
    market = await avatarMarket.deploy(token.address, manager.address);
    await market.deployed();

    badAddressError = await market.BAD_ADDRESS_ERROR.call();
    badCountError = await market.BAD_COUNT_ERROR.call();
    badAmountError = await market.BAD_AMOUNT_ERROR.call();
    totalSupplyError = await market.TOTAL_SUPPLY_LIMIT_ERROR.call();
    allowPresaleError = await market.ALLOW_PRESALE_ERROR.call();
    presaleCountTotalLimitError =
      await market.PRESALE_COUNT_TOTAL_LIMIT_ERROR.call();
    presaleCountUserLimitError =
      await market.PRESALE_COUNT_USER_LIMIT_ERROR.call();
    claimError = await market.CLAIM_ERROR.call();

    await token.setAvatarMarketAddress(market.address);
  });

  it("Only a user with CFO role can set a new public price", async function () {
    await expect(
      market.connect(addr1).setPublicPrice(ethers.utils.parseEther("0.1"))
    ).to.be.revertedWith(
      `AccessControl: account ${addr1.address
        .toString()
        .toLowerCase()} is missing role ${cfoRole}`
    );
  });

  it("Only a user with CFO role can set a new presale price", async function () {
    await expect(
      market.connect(addr1).setPresalePrice(ethers.utils.parseEther("0.1"))
    ).to.be.revertedWith(
      `AccessControl: account ${addr1.address
        .toString()
        .toLowerCase()} is missing role ${cfoRole}`
    );
  });

  it("Only a user with CFO role can allow new presale", async function () {
    const psPrice = ethers.utils.parseEther("0.02");
    await expect(
      market.connect(addr1).allowPresale(10, psPrice)
    ).to.be.revertedWith(
      `AccessControl: account ${addr1.address
        .toString()
        .toLowerCase()} is missing role ${cfoRole}`
    );
  });

  it("Only a user with CFO role can toggle public sale started", async function () {
    const psPrice = ethers.utils.parseEther("0.02");
    await expect(
      market.connect(addr1).togglePublicSaleStarted(psPrice)
    ).to.be.revertedWith(
      `AccessControl: account ${addr1.address
        .toString()
        .toLowerCase()} is missing role ${cfoRole}`
    );
  });

  it("An admin cannot allow presale with a count that exceeds total available supply", async function () {
    const psPrice = ethers.utils.parseEther("0.02");
    await market.connect(owner).setPresaleMaxBuyCount(5);

    await expect(
      market.connect(owner).allowPresale(11, psPrice)
    ).to.be.revertedWith(totalSupplyError);

    expect(await market.connect(owner).allowPresale(5, psPrice))
      .to.emit(market, "PresaleAllowed")
      .withArgs(owner.address, 5, psPrice);
    let currentPrice = await market.presalePrice();
    for (let i = 0; i < 5; i++) {
      await market
        .connect(addr2)
        .buy(addr2.address, 1, { value: currentPrice });
    }
    expect(await market.presaleRemainingCount()).to.equal(5);

    expect(await market.connect(owner).allowPresale(5, psPrice))
      .to.emit(market, "PresaleAllowed")
      .withArgs(owner.address, 5, psPrice);
    currentPrice = await market.presalePrice();
    for (let i = 0; i < 5; i++) {
      await market
        .connect(addr1)
        .buy(addr1.address, 1, { value: currentPrice });
    }
    expect(await market.presaleRemainingCount()).to.equal(10);

    await expect(
      market.connect(owner).allowPresale(1, psPrice)
    ).to.be.revertedWith(totalSupplyError);
  });

  it("An admin cannot allow presale if the public sale started", async function () {
    const price = ethers.utils.parseEther("0.05");
    expect(await market.togglePublicSaleStarted(price))
      .to.emit(market, "PublicSaleStarted")
      .withArgs(owner.address, price);
    const psPrice = ethers.utils.parseEther("0.02");

    await expect(
      market.connect(owner).allowPresale(5, psPrice)
    ).to.be.revertedWith(allowPresaleError);
  });

  it("A user cannot buy a token if it pays a wrong value during presale", async function () {
    const psPrice = ethers.utils.parseEther("0.02");
    expect(await market.connect(owner).allowPresale(5, psPrice))
      .to.emit(market, "PresaleAllowed")
      .withArgs(owner.address, 5, psPrice);

    const currentPrice = await market.presalePrice();
    await expect(
      market
        .connect(addr2)
        .buy(addr2.address, 1, { value: currentPrice.sub(1) })
    ).to.be.revertedWith(badAmountError);
  });

  it("A user cannot buy a token if it pays a wrong value during public sale", async function () {
    let price = ethers.utils.parseEther("0.05");
    expect(await market.togglePublicSaleStarted(price))
      .to.emit(market, "PublicSaleStarted")
      .withArgs(owner.address, price);

    price = await market.publicPrice();
    await expect(
      market.connect(addr2).buy(addr2.address, 1, { value: price.sub(1) })
    ).to.be.revertedWith(badAmountError);
  });

  it("A user cannot buy more tokens than it's allowed during presale", async function () {
    const psPrice = ethers.utils.parseEther("0.02");
    expect(await market.connect(owner).allowPresale(10, psPrice))
      .to.emit(market, "PresaleAllowed")
      .withArgs(owner.address, 10, psPrice);
    const currentPrice = await market.presalePrice();
    const count = (await market.presaleMaxBuyCount()).sub(2);
    await market
      .connect(addr2)
      .buy(addr2.address, count, { value: currentPrice.mul(count) });
    await expect(
      market
        .connect(addr2)
        .buy(addr2.address, 3, { value: currentPrice.mul(3) })
    ).to.be.revertedWith(presaleCountUserLimitError);
  });

  it("A user cannot buy tokens if the total allowed presale count exceeded", async function () {
    const psPrice = ethers.utils.parseEther("0.02");
    expect(await market.connect(owner).allowPresale(9, psPrice))
      .to.emit(market, "PresaleAllowed")
      .withArgs(owner.address, 9, psPrice);

    const currentPrice = await market.presalePrice();
    const count = await market.presaleMaxBuyCount();

    await market
      .connect(addr2)
      .buy(addr2.address, count, { value: currentPrice.mul(count) });
    await expect(
      market
        .connect(addr1)
        .buy(addr1.address, count, { value: currentPrice.mul(count) })
    ).to.be.revertedWith(presaleCountTotalLimitError);
  });

  it("A user cannot buy more tokens than it's allowed in one transaction during public sale", async function () {
    let price = ethers.utils.parseEther("0.05");
    expect(await market.togglePublicSaleStarted(price))
      .to.emit(market, "PublicSaleStarted")
      .withArgs(owner.address, price);
    price = await market.publicPrice();
    const maxCount = await market.maxBuyCount();
    await expect(
      market
        .connect(addr2)
        .buy(addr2.address, maxCount.add(1), { value: price })
    ).to.be.revertedWith(badCountError);
  });

  it("A user cannot buy more tokens than it's available during public sale", async function () {
    const psPrice = ethers.utils.parseEther("0.02");
    await market.connect(owner).setPresaleMaxBuyCount(5);
    await market.connect(owner).setMaxBuyCount(5);

    await expect(
      market.connect(owner).allowPresale(11, psPrice)
    ).to.be.revertedWith(totalSupplyError);

    expect(await market.connect(owner).allowPresale(5, psPrice))
      .to.emit(market, "PresaleAllowed")
      .withArgs(owner.address, 5, psPrice);
    const currentPrice = await market.presalePrice();
    for (let i = 0; i < 5; i++) {
      await market
        .connect(addr2)
        .buy(addr2.address, 1, { value: currentPrice });
    }

    let price = ethers.utils.parseEther("0.05");

    expect(await market.togglePublicSaleStarted(price))
      .to.emit(market, "PublicSaleStarted")
      .withArgs(owner.address, price);
    price = await market.publicPrice();
    const maxCount = await market.maxBuyCount();
    await market
      .connect(addr2)
      .buy(addr2.address, maxCount, { value: price.mul(maxCount) });

    await expect(
      market.connect(addr3).buy(addr3.address, 1, { value: price })
    ).to.be.revertedWith(totalSupplyError);
  });

  it("A user cannot buy the tokens to another contract", async function () {
    let price = ethers.utils.parseEther("0.05");
    expect(await market.togglePublicSaleStarted(price))
      .to.emit(market, "PublicSaleStarted")
      .withArgs(owner.address, price);
    price = await market.publicPrice();
    await expect(
      market.connect(addr3).buy(token.address, 1, { value: price })
    ).to.be.revertedWith(badAddressError);
  });

  it("A user cannot buy the tokens if the market is paused", async function () {
    let price = ethers.utils.parseEther("0.05");
    expect(await market.togglePublicSaleStarted(price))
      .to.emit(market, "PublicSaleStarted")
      .withArgs(owner.address, price);
    price = await market.publicPrice();
    await expect(market.connect(addr3).buy(addr1.address, 1, { value: price }))
      .to.emit(market, "AvatarBought")
      .withArgs(addr3.address, addr1.address, 1);
    await expect(market.connect(owner).pause())
      .to.emit(market, "Paused")
      .withArgs(owner.address);
    await expect(
      market.connect(addr3).buy(addr1.address, 1, { value: price })
    ).to.be.revertedWith("Pausable: paused");
  });

  it("A user cannot claim its tokens if public sale is not toggled", async function () {
    await expect(
      market.connect(addr2).claim(addr1.address, 1)
    ).to.be.revertedWith(claimError);
  });

  it("A user cannot claim more tokens than it bought during presale", async function () {
    await market.allowPresale(10, ethers.utils.parseEther("0.02"));
    const currentPrice = await market.presalePrice();
    await market
      .connect(addr2)
      .buy(addr1.address, 1, { value: currentPrice.mul(2) });

    const price = ethers.utils.parseEther("0.05");
    await market.togglePublicSaleStarted(price);

    await expect(
      market.connect(addr2).claim(addr2.address, 2)
    ).to.be.revertedWith(badCountError);
  });

  it("A user cannot claim the tokens to another contract", async function () {
    await market.allowPresale(10, ethers.utils.parseEther("0.02"));
    const currentPrice = await market.presalePrice();
    await market.connect(addr2).buy(addr1.address, 1, { value: currentPrice });

    const price = ethers.utils.parseEther("0.05");
    await market.togglePublicSaleStarted(price);

    await expect(
      market.connect(addr2).claim(token.address, 1)
    ).to.be.revertedWith(badAddressError);
  });

  it("A user cannot claim the tokens if the market is paused", async function () {
    await market.allowPresale(10, ethers.utils.parseEther("0.02"));
    const currentPrice = await market.presalePrice();
    await market
      .connect(addr2)
      .buy(addr1.address, 2, { value: currentPrice.mul(2) });

    let price = ethers.utils.parseEther("0.05");
    expect(await market.togglePublicSaleStarted(price))
      .to.emit(market, "PublicSaleStarted")
      .withArgs(owner.address, price);

    price = await market.publicPrice();
    await expect(market.connect(addr1).claim(addr1.address, 1))
      .to.emit(market, "AvatarClaimed")
      .withArgs(addr1.address, addr1.address, 1);

    await expect(market.connect(owner).pause())
      .to.emit(market, "Paused")
      .withArgs(owner.address);
    await expect(
      market.connect(addr1).claim(addr1.address, 1)
    ).to.be.revertedWith("Pausable: paused");
  });

  it("A user can buy multiple tokens during presale", async function () {
    const price = ethers.utils.parseEther("0.02");
    await market.allowPresale(10, price);
    const currentPrice = await market.presalePrice();
    const maxCount = await market.presaleMaxBuyCount();

    expect(currentPrice).to.equal(price);
    expect(maxCount).to.equal(5);
    expect(await market.totalAllowedPresaleCount()).to.equal(10);
    expect(await market.currentPresaleCount()).to.equal(0);

    expect(
      await market
        .connect(addr2)
        .buy(addr1.address, maxCount, { value: currentPrice.mul(maxCount) })
    )
      .to.emit(market, "AvatarPresold")
      .withArgs(addr2.address, addr1.address, maxCount);

    expect(await market.currentPresaleCount()).to.equal(maxCount);
  });

  it("A user can claim multiple tokens after public sale toggled", async function () {
    await market.allowPresale(10, ethers.utils.parseEther("0.02"));
    const currentPrice = await market.presalePrice();

    expect(await market.presaleRemainingCount()).to.equal(0);
    await market
      .connect(addr2)
      .buy(addr1.address, 2, { value: currentPrice.mul(2) });
    expect(await market.presaleRemainingCount()).to.equal(2);

    const price = ethers.utils.parseEther("0.05");
    await market.togglePublicSaleStarted(price);

    expect(await token.currentTokenCount()).to.equal(0);

    expect(await market.connect(addr1).claim(addr2.address, 2))
      .to.emit(market, "AvatarClaimed")
      .withArgs(addr1.address, addr2.address, 1)
      .to.emit(market, "AvatarClaimed")
      .withArgs(addr1.address, addr2.address, 2)
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr2.address, 1)
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr2.address, 2);

    expect(await token.ownerOf(1)).to.equal(addr2.address);
    expect(await token.ownerOf(2)).to.equal(addr2.address);

    expect(await token.currentTokenCount()).to.equal(2);
    expect(await market.presaleRemainingCount()).to.equal(0);

    await expect(
      market.connect(addr1).claim(addr2.address, 1)
    ).to.be.revertedWith(badCountError);
  });

  it("A user can buy multiple tokens in one transaction during public sale", async function () {
    let price = ethers.utils.parseEther("0.05");
    await market.togglePublicSaleStarted(price);

    expect(await market.publicPrice()).to.equal(price);

    price = await market.publicPrice();
    const maxCount = await market.maxBuyCount();

    expect(
      await market
        .connect(addr2)
        .buy(addr1.address, maxCount, { value: price.mul(maxCount) })
    )
      .to.emit(market, "AvatarBought")
      .withArgs(addr2.address, addr1.address, 1)
      .to.emit(market, "AvatarBought")
      .withArgs(addr2.address, addr1.address, 2)
      .to.emit(market, "AvatarBought")
      .withArgs(addr2.address, addr1.address, 3)
      .to.emit(market, "AvatarBought")
      .withArgs(addr2.address, addr1.address, 4)
      .to.emit(market, "AvatarBought")
      .withArgs(addr2.address, addr1.address, 5)
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1)
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 2)
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 3)
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 4)
      .to.emit(token, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 5);

    expect(await token.ownerOf(1)).to.equal(addr1.address);
    expect(await token.ownerOf(2)).to.equal(addr1.address);
    expect(await token.ownerOf(3)).to.equal(addr1.address);
    expect(await token.ownerOf(4)).to.equal(addr1.address);
    expect(await token.ownerOf(5)).to.equal(addr1.address);

    expect(await token.tokenURI(1)).to.equal(defaultBabyUri);
    expect(await token.tokenURI(2)).to.equal(defaultBabyUri);
    expect(await token.tokenURI(3)).to.equal(defaultBabyUri);
    expect(await token.tokenURI(4)).to.equal(defaultBabyUri);
    expect(await token.tokenURI(5)).to.equal(defaultBabyUri);
  });
});
