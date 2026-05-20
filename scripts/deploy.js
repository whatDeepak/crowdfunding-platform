// Deploy CrowdfundingEscrow to local Hardhat node or Polygon Amoy testnet
//
// Usage:
//   Local: npx hardhat run scripts/deploy.js --network localhost
//   Amoy:  npx hardhat run scripts/deploy.js --network amoy
//
// After deployment, copy the contract address into .env:
//   NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
//   NEXT_PUBLIC_ADMIN_WALLET=<your deployer address, lowercase>
//   NEXT_PUBLIC_CHAIN_ID=80002
//   NEXT_PUBLIC_NETWORK_RPC_URL=https://rpc-amoy.polygon.technology

const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH');

  const Factory  = await ethers.getContractFactory('CrowdfundingEscrow');
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log('\n✅ CrowdfundingEscrow deployed to:', address);
  console.log('   Admin wallet (deployer):', deployer.address.toLowerCase());

  console.log('\nAdd to .env.local:');
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  console.log(`NEXT_PUBLIC_ADMIN_WALLET=${deployer.address.toLowerCase()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
