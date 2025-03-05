import React from 'react';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { cn } from '@/lib/utils';

interface NetworkStatusProps {
  className?: string;
  showDetails?: boolean;
}

export function NetworkStatus({ className, showDetails = false }: NetworkStatusProps) {
  const { isOnline, isSyncing, lastSyncTime } = useNetworkStatus();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center gap-1.5">
        <div 
          className={cn(
            'h-2.5 w-2.5 rounded-full', 
            isOnline ? 'bg-green-500' : 'bg-red-500',
            isSyncing && 'animate-pulse'
          )} 
        />
        <span className="text-sm font-medium">
          {isOnline ? 'Online' : 'Offline'}
          {isSyncing && ' (Syncing...)'}
        </span>
      </div>
      
      {showDetails && lastSyncTime && (
        <span className="text-xs text-gray-500">
          Last sync: {formatLastSync(lastSyncTime)}
        </span>
      )}
    </div>
  );
}

function formatLastSync(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  
  if (diffSec < 60) {
    return 'Just now';
  } else if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else {
    return date.toLocaleString();
  }
} 