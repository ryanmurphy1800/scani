import { useEffect, useState, useCallback } from 'react';
import { 
  isNetworkAvailable, 
  addQueueEventListener, 
  removeQueueEventListener,
  getPendingOperationCount,
  getFailedOperationCount,
  processOperationQueue,
  retryAllFailedOperations,
  QueuedOperation,
  OperationStatus
} from '@/services/productService';

export interface NetworkStatusState {
  isOnline: boolean;
  pendingOperations: number;
  failedOperations: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
}

export function useNetworkStatus() {
  const [state, setState] = useState<NetworkStatusState>({
    isOnline: isNetworkAvailable(),
    pendingOperations: 0,
    failedOperations: 0,
    isSyncing: false,
    lastSyncTime: null
  });

  // Update pending and failed operation counts
  const updateOperationCounts = useCallback(async () => {
    const pendingOperations = await getPendingOperationCount();
    const failedOperations = await getFailedOperationCount();
    
    setState(prevState => ({
      ...prevState,
      pendingOperations,
      failedOperations
    }));
  }, []);

  // Sync function to process the queue
  const syncQueue = useCallback(async (force: boolean = false) => {
    if (!state.isOnline && !force) return;
    
    setState(prevState => ({ ...prevState, isSyncing: true }));
    
    try {
      await processOperationQueue(force);
      await updateOperationCounts();
      
      setState(prevState => ({ 
        ...prevState, 
        isSyncing: false,
        lastSyncTime: new Date()
      }));
    } catch (error) {
      console.error('Error syncing queue:', error);
      setState(prevState => ({ ...prevState, isSyncing: false }));
    }
  }, [state.isOnline, updateOperationCounts]);

  // Retry all failed operations
  const retryAllFailed = useCallback(async () => {
    setState(prevState => ({ ...prevState, isSyncing: true }));
    
    try {
      await retryAllFailedOperations();
      await updateOperationCounts();
      
      setState(prevState => ({ 
        ...prevState, 
        isSyncing: false,
        lastSyncTime: new Date()
      }));
    } catch (error) {
      console.error('Error retrying failed operations:', error);
      setState(prevState => ({ ...prevState, isSyncing: false }));
    }
  }, [updateOperationCounts]);

  // Monitor network status
  useEffect(() => {
    const handleNetworkChange = () => {
      const isOnline = isNetworkAvailable();
      const wasOnline = state.isOnline;
      
      setState(prevState => ({ 
        ...prevState, 
        isOnline 
      }));
      
      // If we just came back online, sync the queue
      if (isOnline && !wasOnline) {
        syncQueue();
      }
    };

    // Handle queue events
    const handleQueueEvent = async () => {
      await updateOperationCounts();
    };

    // Set up event listeners
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
    
    addQueueEventListener('operationAdded', handleQueueEvent);
    addQueueEventListener('operationCompleted', handleQueueEvent);
    addQueueEventListener('operationFailed', handleQueueEvent);
    addQueueEventListener('queueProcessingCompleted', handleQueueEvent);
    
    // Initial counts
    updateOperationCounts();
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
      
      removeQueueEventListener('operationAdded', handleQueueEvent);
      removeQueueEventListener('operationCompleted', handleQueueEvent);
      removeQueueEventListener('operationFailed', handleQueueEvent);
      removeQueueEventListener('queueProcessingCompleted', handleQueueEvent);
    };
  }, [updateOperationCounts, syncQueue, state.isOnline]);

  return {
    ...state,
    syncQueue,
    retryAllFailed
  };
} 