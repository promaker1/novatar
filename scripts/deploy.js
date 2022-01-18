const { ethers } = require("hardhat");
const fs = require("fs");

const contractsJson = fs.createWriteStream("contracts.json");
const verifyContracts = fs.createWriteStream("verify_contracts.sh");

/**
 * The following block is for testnet (Rinkeby).
 * Must be changed for mainnet!
 * */
const network = "ropsten";
const ceo = "0x6F4C6c4d5C8f93555Cede0400fe7616e1678Db70";
const coo = "0x6F4C6c4d5C8f93555Cede0400fe7616e1678Db70";
const cfo = "0x6F4C6c4d5C8f93555Cede0400fe7616e1678Db70";
/** ======= The end of the block ======= */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const AccessControlManager = await ethers.getContractFactory(
    "AccessControlManager"
  );
  const manager = await AccessControlManager.deploy();
  console.log("Access control manager address:", manager.address);
  contractsJson.write(`{\n\t"manager":"${manager.address}",\n`);
  verifyContracts.write(
    `npx hardhat verify --network ${network} ${manager.address}\n`
  );

  const AvatarToken = await ethers.getContractFactory("AvatarToken");
  const totalSupply = 25000;
  const defaultBabyCid = "DEFAULT_BABY_CID"; // must be set to an actual CID.
  const defaultAdultCid = "DEFAULT_ADULT_CID"; // must be set to an actual CID.
  const growUpTime = 30 * 24 * 60 * 60; // 1 month, in secs
  const priceOfGrowingUp = ethers.utils.parseEther("0.05"); // price of growing up, in wei. Must be set to an actual value.

  const token = await AvatarToken.deploy(
    totalSupply,
    defaultBabyCid,
    defaultAdultCid,
    growUpTime,
    priceOfGrowingUp,
    manager.address
  );

  console.log("Avatar token address:", token.address);
  contractsJson.write(`\t"token":"${token.address}",\n`);
  verifyContracts.write(
    `npx hardhat verify --network ${network} ${token.address} ${totalSupply} ${defaultBabyCid} ${defaultAdultCid} ${growUpTime} ${priceOfGrowingUp} ${manager.address}\n`
  );

  const AvatarMarket = await ethers.getContractFactory("AvatarMarket");
  const market = await AvatarMarket.deploy(token.address, manager.address);

  console.log("Avatar market address:", market.address);
  contractsJson.write(`\t"market":"${market.address}"\n}`);
  verifyContracts.write(
    `npx hardhat verify --network ${network} ${market.address} ${token.address} ${manager.address}\n`
  );

  console.log("Configuring the roles...");
  await manager.deployed();
  const ceoRole = await manager.CEO_ROLE.call();
  const cooRole = await manager.COO_ROLE.call();
  const cfoRole = await manager.CFO_ROLE.call();

  await manager.grantRole(ceoRole, ceo);
  await manager.grantRole(cooRole, coo);
  await manager.grantRole(cfoRole, cfo);

  console.log("Configuring the addresses...");
  await token.deployed();
  await token.setAvatarMarketAddress(market.address);

  console.log("Done.");
}

main()
  // eslint-disable-next-line no-process-exit
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  });
