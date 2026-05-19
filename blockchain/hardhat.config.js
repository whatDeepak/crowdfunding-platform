require('@nomicfoundation/hardhat-toolbox');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SEPOLIA_RPC_URL   = process.env.SEPOLIA_RPC_URL   || '';
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY || '0x' + '0'.repeat(64);

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: {
    version: '0.8.19',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: { chainId: 31337 },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    ...(SEPOLIA_RPC_URL ? {
      sepolia: {
        url: SEPOLIA_RPC_URL,
        accounts: [ADMIN_PRIVATE_KEY],
        chainId: 11155111,
      },
    } : {}),
  },
  paths: {
    sources:   './contracts',
    tests:     './test',
    cache:     './cache',
    artifacts: './artifacts',
  },
};
