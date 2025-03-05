import React, { useState } from 'react';
import { NetworkStatus } from './ui/NetworkStatus';
import { QueueMonitor } from './ui/QueueMonitor';
import { SyncButton } from './ui/SyncButton';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useDataSync } from '@/hooks/use-data-sync';

export function NetworkStatusDemo() {
  const { isOnline, pendingOperations, failedOperations } = useNetworkStatus();
  const { isSyncing, lastSyncTime, lastSyncResult, performSync } = useDataSync('demo-user-id');
  const [showDetails, setShowDetails] = useState(false);
  
  const handleFullSync = async () => {
    await performSync({ forceFullSync: true });
  };
  
  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Network Status & Sync Demo</h1>
      
      <div className="grid gap-6">
        {/* Network Status Section */}
        <section className="bg-white rounded-lg border p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Network Status</h2>
          <div className="flex flex-col gap-4">
            <NetworkStatus showDetails={true} />
            
            <div className="flex items-center gap-2">
              <span className="text-sm">Connection:</span>
              <span className={`text-sm font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="font-medium">Pending:</span> {pendingOperations}
              </div>
              <div className="text-sm">
                <span className="font-medium">Failed:</span> {failedOperations}
              </div>
              {lastSyncTime && (
                <div className="text-sm">
                  <span className="font-medium">Last Sync:</span> {lastSyncTime.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </section>
        
        {/* Sync Controls Section */}
        <section className="bg-white rounded-lg border p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Sync Controls</h2>
          <div className="flex flex-wrap gap-3">
            <SyncButton showStatus={true} />
            <SyncButton variant="outline" size="sm" />
            
            <button
              onClick={handleFullSync}
              disabled={isSyncing || !isOnline}
              className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded font-medium hover:bg-purple-200 disabled:opacity-50"
            >
              Force Full Sync
            </button>
            
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded font-medium hover:bg-gray-200"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
          
          {showDetails && lastSyncResult && (
            <div className="mt-4 text-sm border rounded-md p-3 bg-gray-50">
              <h3 className="font-medium mb-2">Last Sync Result:</h3>
              <ul className="space-y-1">
                <li>
                  <span className="font-medium">Status:</span>{' '}
                  <span className={lastSyncResult.success ? 'text-green-600' : 'text-red-600'}>
                    {lastSyncResult.success ? 'Success' : 'Partial Failure'}
                  </span>
                </li>
                <li>
                  <span className="font-medium">Categories:</span>{' '}
                  {lastSyncResult.categoriesUpdated ? 'Updated' : 'No Change'}
                </li>
                <li>
                  <span className="font-medium">Brands:</span>{' '}
                  {lastSyncResult.brandsUpdated ? 'Updated' : 'No Change'}
                </li>
                <li>
                  <span className="font-medium">Popular Products:</span>{' '}
                  {lastSyncResult.popularProductsUpdated ? 'Updated' : 'No Change'}
                </li>
                <li>
                  <span className="font-medium">User Data:</span>{' '}
                  {lastSyncResult.userDataUpdated ? 'Updated' : 'No Change'}
                </li>
                <li>
                  <span className="font-medium">Queue Processed:</span>{' '}
                  {lastSyncResult.queueProcessed} operations
                </li>
                
                {lastSyncResult.errors.length > 0 && (
                  <li className="mt-2">
                    <span className="font-medium text-red-600">Errors:</span>
                    <ul className="ml-4 mt-1 text-red-600">
                      {lastSyncResult.errors.map((error, index) => (
                        <li key={index} className="text-xs">{error}</li>
                      ))}
                    </ul>
                  </li>
                )}
              </ul>
            </div>
          )}
        </section>
        
        {/* Queue Monitor Section */}
        <section className="bg-white rounded-lg border shadow-sm">
          <QueueMonitor />
        </section>
        
        {/* Compact Queue Monitor */}
        <section className="bg-white rounded-lg border p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Compact Queue Monitor</h2>
          <QueueMonitor compact={true} />
        </section>
        
        {/* Network Testing Tools */}
        <section className="bg-white rounded-lg border p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Network Testing Tools</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                // Simulate going offline
                // Note: This doesn't actually change network status, just for demo purposes
                window.dispatchEvent(new Event('offline'));
              }}
              className="px-3 py-1.5 bg-red-100 text-red-700 rounded font-medium hover:bg-red-200"
            >
              Simulate Offline
            </button>
            
            <button
              onClick={() => {
                // Simulate coming online
                // Note: This doesn't actually change network status, just for demo purposes
                window.dispatchEvent(new Event('online'));
              }}
              className="px-3 py-1.5 bg-green-100 text-green-700 rounded font-medium hover:bg-green-200"
            >
              Simulate Online
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Note: These buttons only simulate the events for testing UI reactions. They don't actually change your network connection.
          </p>
        </section>
      </div>
    </div>
  );
} 