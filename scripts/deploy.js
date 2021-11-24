const hre = require("hardhat");

async function main() {
  const BabyAdult = await hre.ethers.getContractFactory("BabyAdult");
  const token = await BabyAdult.deploy("https://babyadult.com/avatars/");

  await token.deployed();

  console.log("BabyAdult deployed to:", token.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
