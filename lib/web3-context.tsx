'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BrowserProvider, Contract, ethers } from 'ethers';
import { toast } from 'sonner';

// ABI for CrowdfundingEscrow.sol — admin-controlled escrow, no voting
const ESCROW_ABI = [
  // Campaign lifecycle
  "function createCampaign(uint256 targetAmount, uint256 durationDays, string calldata ipfsHash) external returns (uint256)",
  "function donate(uint256 campaignId) external payable",
  "function submitWithdrawalRequest(uint256 campaignId, uint256 requestedAmount, string calldata proofIpfsHash) external",
  "function claimRefund(uint256 campaignId) external",

  // Admin functions
  "function approveWithdrawal(uint256 campaignId, uint256 requestId) external",
  "function rejectWithdrawal(uint256 campaignId, uint256 requestId, string calldata reason) external",
  "function cancelCampaign(uint256 campaignId) external",
  "function withdrawPlatformFees() external",

  // View functions
  "function getCampaign(uint256 campaignId) external view returns (tuple(uint256 id, address creator, uint256 targetAmount, uint256 amountRaised, uint256 deadline, uint8 status, string ipfsMetadataHash, uint256 createdAt))",
  "function getCampaignDonors(uint256 campaignId) external view returns (address[] memory donors, uint256[] memory amounts)",
  "function getWithdrawalRequests(uint256 campaignId) external view returns (tuple(uint256 id, uint256 campaignId, uint256 requestedAmount, string proofIpfsHash, uint8 status, string rejectionReason, uint256 createdAt)[])",
  "function getCreatorCampaigns(address creator) external view returns (uint256[])",
  "function getContractBalance() external view returns (uint256)",
  "function donorContributions(uint256 campaignId, address donor) external view returns (uint256)",
  "function campaignCounter() external view returns (uint256)",
  "function admin() external view returns (address)",
  "function platformFeePercent() external view returns (uint256)",
  "function platformFeesCollected() external view returns (uint256)",

  // Events (for filtering)
  "event CampaignCreated(uint256 indexed campaignId, address indexed creator, uint256 targetAmount, uint256 deadline, string ipfsMetadataHash)",
  "event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 amount, uint256 timestamp)",
  "event WithdrawalRequested(uint256 indexed campaignId, uint256 indexed requestId, uint256 requestedAmount, string proofIpfsHash)",
  "event WithdrawalApproved(uint256 indexed campaignId, uint256 indexed requestId, address indexed creator, uint256 amountReleased, uint256 platformFee)",
  "event WithdrawalRejected(uint256 indexed campaignId, uint256 indexed requestId, string reason)",
  "event CampaignCancelled(uint256 indexed campaignId)",
  "event DonorRefunded(uint256 indexed campaignId, address indexed donor, uint256 amount)",
];

interface Web3ContextType {
  account:          string | null;
  isConnected:      boolean;
  isAdmin:          boolean;
  provider:         BrowserProvider | null;
  contract:         Contract | null;
  balance:          string | null;
  connectWallet:    () => Promise<void>;
  disconnectWallet: () => void;
  loading:          boolean;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account,   setAccount]   = useState<string | null>(null);
  const [provider,  setProvider]  = useState<BrowserProvider | null>(null);
  const [contract,  setContract]  = useState<Contract | null>(null);
  const [balance,   setBalance]   = useState<string | null>(null);
  const [isAdmin,   setIsAdmin]   = useState(false);
  const [loading,   setLoading]   = useState(false);

  const adminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET?.toLowerCase();

  async function initProvider(ethereumProvider: unknown) {
    const web3Provider = new BrowserProvider(ethereumProvider as Parameters<typeof BrowserProvider>[0]);
    const accounts     = await web3Provider.listAccounts();
    if (accounts.length === 0) return null;

    const addr   = accounts[0].address.toLowerCase();
    const signer = await web3Provider.getSigner();
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

    let escrowContract: Contract | null = null;
    if (contractAddress) {
      escrowContract = new Contract(contractAddress, ESCROW_ABI, signer);
    }

    const bal = await web3Provider.getBalance(addr);

    return { addr, web3Provider, escrowContract, bal };
  }

  // Auto-connect on mount if already authorized
  useEffect(() => {
    const tryAutoConnect = async () => {
      if (typeof window === 'undefined' || !window.ethereum) return;
      const result = await initProvider(window.ethereum);
      if (!result) return;
      const { addr, web3Provider, escrowContract, bal } = result;
      setAccount(addr);
      setProvider(web3Provider);
      setContract(escrowContract);
      setBalance(ethers.formatEther(bal));
      setIsAdmin(!!adminWallet && addr === adminWallet);
    };

    tryAutoConnect();

    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          const addr = accounts[0].toLowerCase();
          setAccount(addr);
          setIsAdmin(!!adminWallet && addr === adminWallet);
        } else {
          setAccount(null);
          setIsAdmin(false);
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectWallet = async () => {
    setLoading(true);
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        toast.error('MetaMask is not installed. Please install it to continue.');
        return;
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const result = await initProvider(window.ethereum);
      if (!result) return;

      const { addr, web3Provider, escrowContract, bal } = result;
      setAccount(addr);
      setProvider(web3Provider);
      setContract(escrowContract);
      setBalance(ethers.formatEther(bal));
      setIsAdmin(!!adminWallet && addr === adminWallet);

      toast.success('Wallet connected');
    } catch (error) {
      console.error('connectWallet error:', error);
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
    setIsAdmin(false);
  };

  return (
    <Web3Context.Provider
      value={{
        account,
        isConnected: !!account,
        isAdmin,
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
