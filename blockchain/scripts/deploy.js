const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying with:', deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:       ', ethers.formatEther(balance), 'ETH\n');

  const Factory  = await ethers.getContractFactory('CrowdfundingEscrow');
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log('✅ CrowdfundingEscrow deployed!');
  console.log('   Address:', address);
  console.log('   Admin:  ', deployer.address.toLowerCase());
  console.log('\nAdd to root .env:');
  console.log('─'.repeat(55));
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  console.log(`NEXT_PUBLIC_ADMIN_WALLET=${deployer.address.toLowerCase()}`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=31337`);
  console.log(`NEXT_PUBLIC_NETWORK_RPC_URL=http://127.0.0.1:8545`);
  console.log('─'.repeat(55));
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
