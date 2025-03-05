import React, { useState } from 'react';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { cn } from '@/lib/utils';
import { getOperationQueue, OperationType, OperationStatus } from '@/services/productService';

interface QueueMonitorProps {
  className?: string;
  compact?: boolean;
}

export function QueueMonitor({ className, compact = false }: QueueMonitorProps) {
  const { 
    isOnline, 
    pendingOperations, 
    failedOperations, 
    isSyncing, 
    syncQueue, 
    retryAllFailed 
  } = useNetworkStatus();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [queueDetails, setQueueDetails] = useState<any[]>([]);
  
  // Load queue details when expanding
  const handleToggleExpand = async () => {
    if (!isExpanded && !queueDetails.length) {
      const queue = await getOperationQueue();
      setQueueDetails(queue);
    }
    setIsExpanded(!isExpanded);
  };
  
  // Force sync
  const handleSync = () => {
    syncQueue(true);
  };
  
  // Retry failed operations
  const handleRetry = () => {
    retryAllFailed();
  };
  
  // Refresh queue details
  const handleRefresh = async () => {
    const queue = await getOperationQueue();
    setQueueDetails(queue);
  };
  
  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 text-sm', className)}>
        <div className="flex items-center gap-1">
          <span className="font-medium">Queue:</span>
          <span>{pendingOperations} pending</span>
          {failedOperations > 0 && (
            <span className="text-red-500">, {failedOperations} failed</span>
          )}
        </div>
        
        {(pendingOperations > 0 || failedOperations > 0) && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="text-xs px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded disabled:opacity-50"
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>
    );
  }
  
  return (
    <div className={cn('rounded-lg border p-4', className)}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Operation Queue</h3>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
          >
            Refresh
          </button>
          <button
            onClick={handleToggleExpand}
            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
      
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">Status:</span>
            <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
            {isSyncing && <span className="text-blue-600 animate-pulse">(Syncing...)</span>}
          </div>
          
          <div className="text-sm">
            <span className="mr-4">{pendingOperations} pending operations</span>
            <span>{failedOperations} failed operations</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          {failedOperations > 0 && (
            <button
              onClick={handleRetry}
              disabled={isSyncing}
              className="text-sm px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded disabled:opacity-50"
            >
              Retry Failed
            </button>
          )}
          
          <button
            onClick={handleSync}
            disabled={isSyncing || (!isOnline && pendingOperations === 0)}
            className="text-sm px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded disabled:opacity-50"
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>
      
      {isExpanded && queueDetails.length > 0 && (
        <div className="mt-4 border rounded overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Retries</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {queueDetails.map(operation => (
                <tr key={operation.id}>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{formatOperationType(operation.type)}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    <span className={getStatusColor(operation.status)}>
                      {operation.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {new Date(operation.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {operation.retryCount} / {operation.maxRetries}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {isExpanded && queueDetails.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          No operations in queue
        </div>
      )}
    </div>
  );
}

function formatOperationType(type: OperationType): string {
  switch (type) {
    case OperationType.SUBMIT_PRODUCT:
      return 'Submit Product';
    case OperationType.UPDATE_PRODUCT:
      return 'Update Product';
    case OperationType.UPLOAD_IMAGE:
      return 'Upload Image';
    case OperationType.RECORD_SCAN:
      return 'Record Scan';
    case OperationType.CUSTOM:
      return 'Custom Operation';
    default:
      return type;
  }
}

function getStatusColor(status: OperationStatus): string {
  switch (status) {
    case OperationStatus.PENDING:
      return 'text-blue-600';
    case OperationStatus.IN_PROGRESS:
      return 'text-blue-600 font-medium';
    case OperationStatus.COMPLETED:
      return 'text-green-600';
    case OperationStatus.FAILED:
      return 'text-red-600 font-medium';
    case OperationStatus.RETRY:
      return 'text-yellow-600';
    default:
      return '';
  }
} 