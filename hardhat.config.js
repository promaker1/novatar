require("dotenv").config();

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.0",
  networks: {
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/8ad3adc31c5045cea5c963aab8422028",
      accounts: [
        "0ac40a135b89c3a2f0aecc596627ca19724254aa487c720c4345cba268870294",
        "9a6eaa838235aa429273be0ebe6134f284032355ecb620d41443b5db330d32a8",
      ],
    },
    // ropsten: {
    //   url: process.env.NETWORK_URL,
    //   accounts: [process.env.PRIVATE_KEY],
    // },
    // main: {
    //   url: process.env.NETWORK_URL,
    //   accounts: [process.env.PRIVATE_KEY],
    // },
  },
  etherscan: {
    apiKey: "NM72XRP3ZU59BE59S5MWY8WAIXAG6RD3YW",
  },
};
