require('@nomicfoundation/hardhat-toolbox');
// Load .env.local first (overrides .env), fall back to .env
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY || '0x' + '0'.repeat(64);

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: {
    version: '0.8.19',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // Local node — `npx hardhat node` gives 20 accounts with 10,000 ETH each
    // Connect MetaMask to localhost:8545, chain ID 31337
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    // Polygon Amoy testnet — free public RPC, no account needed
    // Faucet: https://faucet.polygon.technology  (select Amoy, need 0.001 POL on mainnet)
    // Alt faucet: https://www.alchemy.com/faucets/polygon-amoy  (free Alchemy account)
    amoy: {
      url: 'https://rpc-amoy.polygon.technology',
      accounts: [ADMIN_PRIVATE_KEY],
      chainId: 80002,
    },
  },
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || '',
    },
    customChains: [
      {
        network: 'polygonAmoy',
        chainId: 80002,
        urls: {
          apiURL:     'https://api-amoy.polygonscan.com/api',
          browserURL: 'https://amoy.polygonscan.com',
        },
      },
    ],
  },
  paths: {
    sources:   './contracts',
    tests:     './test',
    cache:     './cache',
    artifacts: './artifacts',
  },
};
