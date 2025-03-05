import React from 'react';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { cn } from '@/lib/utils';

interface SyncButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
}

export function SyncButton({ 
  className, 
  variant = 'default', 
  size = 'md',
  showStatus = false
}: SyncButtonProps) {
  const { isOnline, isSyncing, pendingOperations, syncQueue } = useNetworkStatus();
  
  const handleSync = () => {
    syncQueue(true);
  };
  
  // Determine button styles based on variant and size
  const buttonStyles = cn(
    'flex items-center gap-2 rounded font-medium transition-colors',
    {
      // Variants
      'bg-blue-600 hover:bg-blue-700 text-white': variant === 'default',
      'border border-blue-600 text-blue-600 hover:bg-blue-50': variant === 'outline',
      'text-blue-600 hover:bg-blue-50': variant === 'ghost',
      
      // Sizes
      'text-xs px-2 py-1': size === 'sm',
      'text-sm px-3 py-1.5': size === 'md',
      'text-base px-4 py-2': size === 'lg',
      
      // Disabled state
      'opacity-50 cursor-not-allowed': isSyncing || !isOnline
    },
    className
  );
  
  return (
    <button
      onClick={handleSync}
      disabled={isSyncing || !isOnline}
      className={buttonStyles}
      title={!isOnline ? 'You are offline' : undefined}
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className={cn('h-4 w-4', isSyncing && 'animate-spin')} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
        />
      </svg>
      
      <span>
        {isSyncing ? 'Syncing...' : 'Sync Now'}
        {showStatus && pendingOperations > 0 && !isSyncing && ` (${pendingOperations})`}
      </span>
    </button>
  );
} 