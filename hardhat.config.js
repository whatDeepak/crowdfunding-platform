require('@nomicfoundation/hardhat-toolbox');
// Load .env.local first (overrides .env), fall back to .env
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || '';
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
    // Sepolia testnet — get free ETH from:
    //   https://faucet.quicknode.com/ethereum/sepolia  (no mainnet ETH needed)
    //   https://cloud.google.com/application/web3/faucet/ethereum/sepolia
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: ADMIN_PRIVATE_KEY ? [ADMIN_PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || '',
  },
  paths: {
    sources:   './contracts',
    tests:     './test',
    cache:     './cache',
    artifacts: './artifacts',
  },
};
