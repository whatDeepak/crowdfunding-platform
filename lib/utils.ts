import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert a raw ethers/MetaMask error into a short user-facing string.
 * Returns "Transaction cancelled" for user rejections instead of the raw ethers stack.
 */
export function parseContractError(err: unknown): string {
  const e = err as Record<string, any>;
  // User cancelled MetaMask popup (ethers v6 ACTION_REJECTED or legacy 4001)
  if (
    e?.code === 'ACTION_REJECTED' ||
    e?.info?.error?.code === 4001 ||
    e?.error?.code === 4001
  ) {
    return 'Transaction cancelled';
  }
  // Contract revert with a human-readable reason
  if (e?.reason && typeof e.reason === 'string') return e.reason;
  // Ethers v6 shortMessage (strips noise from the full message)
  if (e?.shortMessage && typeof e.shortMessage === 'string') return e.shortMessage;
  // Plain message fallback
  if (e?.message && typeof e.message === 'string') {
    // Strip long ethers serialisation noise
    const msg = e.message.split('(')[0].trim();
    return msg || 'Transaction failed';
  }
  return 'Transaction failed';
}
