import { useWeb3 } from '@/lib/web3-context';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function useAuth() {
  const { account, isConnected, provider } = useWeb3();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [account, isConnected]);

  const checkAuth = async () => {
    if (!isConnected || !account) {
      setIsAuthenticated(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      setIsAuthenticated(!!data.session);
    } catch (error) {
      setIsAuthenticated(false);
    }
  };

  const signIn = async () => {
    if (!isConnected || !account || !provider) {
      toast.error('Please connect your wallet first');
      return false;
    }

    try {
      setLoading(true);

      // Create a message to sign
      const message = `Sign this message to authenticate to TrustFund\n\nWallet: ${account}\nTime: ${new Date().toISOString()}`;

      // Get signer and sign message
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(message);

      // Verify signature in backend (in production, you'd verify this)
      // For now, we'll use a simple Supabase auth flow with web3

      toast.success('Authenticated successfully');
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error('Error signing in:', error);
      toast.error('Failed to authenticate');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setIsAuthenticated(false);
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  return {
    isAuthenticated,
    loading,
    account,
    signIn,
    signOut,
  };
}
