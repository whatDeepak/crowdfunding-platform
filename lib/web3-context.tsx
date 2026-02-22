'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BrowserProvider, Contract, ethers } from 'ethers';
import { toast } from 'sonner';

// Contract ABI (you'll update this after deployment)
const CROWDFUNDING_ABI = [
  "function createCampaign(string memory _title, string memory _description, uint256 _targetAmount, uint256 _durationDays, string memory _ipfsHash) public returns (uint256)",
  "function donate(uint256 _campaignId) public payable",
  "function getCampaign(uint256 _campaignId) public view returns (tuple(uint256 id, address creator, string title, string description, uint256 targetAmount, uint256 deadline, uint256 amountRaised, uint8 status, string ipfsHash, uint256 createdAt))",
  "function getCampaignMilestones(uint256 _campaignId) public view returns (tuple(uint256 id, uint256 campaignId, string title, string description, uint256 releaseAmount, uint256 deadline, uint8 status, uint256 votes, uint256 totalVoters)[])",
  "function getCampaignDonations(uint256 _campaignId) public view returns (tuple(uint256 id, uint256 campaignId, address donor, uint256 amount, uint256 timestamp, bool refunded)[])",
  "function getCreatorCampaigns(address _creator) public view returns (uint256[])",
  "function createMilestone(uint256 _campaignId, string memory _title, string memory _description, uint256 _releaseAmount, uint256 _durationDays) public",
  "function voteMilestone(uint256 _campaignId, uint256 _milestoneId, bool _approve) public",
  "function withdrawMilestoneFunds(uint256 _campaignId, uint256 _milestoneId) public",
  "function campaignCounter() public view returns (uint256)",
];

interface Web3ContextType {
  account: string | null;
  isConnected: boolean;
  provider: BrowserProvider | null;
  contract: Contract | null;
  balance: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  loading: boolean;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkIfWalletIsConnected = async () => {
      try {
        if (typeof window !== 'undefined' && window.ethereum) {
          const provider = new BrowserProvider(window.ethereum);
          const accounts = await provider.listAccounts();
          
          if (accounts.length > 0) {
            const accountAddress = accounts[0].address;
            setAccount(accountAddress);
            setProvider(provider);
            
            // Initialize contract
            const signer = await provider.getSigner();
            const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
            if (contractAddress) {
              const crowdfundingContract = new Contract(contractAddress, CROWDFUNDING_ABI, signer);
              setContract(crowdfundingContract);
            }

            // Get balance
            const balance = await provider.getBalance(accountAddress);
            setBalance(ethers.formatEther(balance));
          }
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    };

    checkIfWalletIsConnected();

    // Listen for account changes
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          setAccount(null);
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  }, []);

  const connectWallet = async () => {
    setLoading(true);
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });

        const accountAddress = accounts[0];
        setAccount(accountAddress);
        setProvider(provider);

        // Initialize contract
        const signer = await provider.getSigner();
        const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
        if (contractAddress) {
          const crowdfundingContract = new Contract(contractAddress, CROWDFUNDING_ABI, signer);
          setContract(crowdfundingContract);
        }

        // Get balance
        const balance = await provider.getBalance(accountAddress);
        setBalance(ethers.formatEther(balance));

        toast.success('Wallet connected successfully');
      } else {
        toast.error('MetaMask is not installed. Please install it to continue.');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast.error('Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setContract(null);
    setBalance(null);
  };

  return (
    <Web3Context.Provider
      value={{
        account,
        isConnected: !!account,
        provider,
        contract,
        balance,
        connectWallet,
        disconnectWallet,
        loading,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
}
