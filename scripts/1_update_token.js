/* eslint-disable node/no-missing-require */
const { ethers } = require("hardhat");
const fs = require("fs");

const AvatarMarket = require("../artifacts/contracts/AvatarMarket.sol/AvatarMarket.json");

const existingContracts = require("../existing_contracts.json");

const contractsJson = fs.createWriteStream("contracts.json");
const verifyContracts = fs.createWriteStream("1_verify_contracts.sh");

/**
 * The following block is for testnet (Rinkeby).
 * Must be changed for mainnet!
 * */
const network = "rinkeby";
/** ======= The end of the block ======= */

async function main() {
  const [deployer, coo] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const AvatarToken = await ethers.getContractFactory("AvatarToken");
  const totalSupply = 25000;
  const defaultBabyUri = "ipfs://DEFAULT_BABY_CID"; // must be set to an actual URI.
  const defaultAdultCid = "DEFAULT_ADULT_CID"; // must be set to an actual CID.
  const growUpTime = 30 * 24 * 60 * 60; // 1 month, in secs
  const priceOfGrowingUp = ethers.utils.parseEther("0.05"); // price of growing up, in wei. Must be set to an actual value.

  const token = await AvatarToken.deploy(
    totalSupply,
    defaultBabyUri,
    defaultAdultCid,
    growUpTime,
    priceOfGrowingUp,
    existingContracts.manager
  );

  console.log("Avatar token address:", token.address);
  contractsJson.write(`{\n\t"token":"${token.address}"\n}`);
  verifyContracts.write(
    `npx hardhat verify --network ${network} ${token.address} ${totalSupply} ${defaultBabyUri} ${defaultAdultCid} ${growUpTime} ${priceOfGrowingUp} ${existingContracts.manager}\n`
  );

  const avatarMarket = new ethers.Contract(
    existingContracts.market,
    AvatarMarket.abi,
    ethers.provider
  ).connect(deployer);

  console.log("Configuring the addresses...");
  await token.deployed();
  await token.connect(coo).setAvatarMarketAddress(existingContracts.market);

  await avatarMarket.connect(coo).setTokenAddress(token.address);

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
