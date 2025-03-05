import { useState, useCallback, useEffect } from 'react';
import { syncLocalData, needsSync, isNetworkAvailable } from '@/services/productService';
import { useNetworkStatus } from './use-network-status';

// Cache keys
const CATEGORIES_CACHE_KEY = 'scani_categories';
const BRANDS_CACHE_KEY = 'scani_brands';
const POPULAR_CACHE_KEY = 'scani_popular_products';

// Cache max ages
const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours
const ONE_HOUR = 60 * 60 * 1000; // 1 hour

export interface SyncOptions {
  forceFullSync?: boolean;
  syncCategories?: boolean;
  syncBrands?: boolean;
  syncPopularProducts?: boolean;
  syncUserData?: boolean;
  userId?: string;
}

export interface SyncResult {
  success: boolean;
  categoriesUpdated: boolean;
  brandsUpdated: boolean;
  popularProductsUpdated: boolean;
  userDataUpdated: boolean;
  queueProcessed: number;
  errors: string[];
}

export function useDataSync(userId?: string) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const { isOnline } = useNetworkStatus();

  // Function to check what needs to be synced
  const checkSyncNeeds = useCallback(async () => {
    if (!isNetworkAvailable()) return null;

    const syncNeeds = {
      categories: await needsSync(CATEGORIES_CACHE_KEY, ONE_DAY),
      brands: await needsSync(BRANDS_CACHE_KEY, ONE_DAY),
      popularProducts: await needsSync(POPULAR_CACHE_KEY, ONE_HOUR),
    };

    return syncNeeds;
  }, []);

  // Function to perform sync
  const performSync = useCallback(async (options: SyncOptions = {}) => {
    if (isSyncing) return null;
    
    setIsSyncing(true);
    
    try {
      // If no specific sync options are provided, check what needs to be synced
      if (!options.forceFullSync && 
          !options.syncCategories && 
          !options.syncBrands && 
          !options.syncPopularProducts && 
          !options.syncUserData) {
        
        const syncNeeds = await checkSyncNeeds();
        
        if (syncNeeds) {
          options = {
            ...options,
            syncCategories: syncNeeds.categories,
            syncBrands: syncNeeds.brands,
            syncPopularProducts: syncNeeds.popularProducts,
            syncUserData: !!userId,
            userId
          };
        }
      }
      
      // Always include userId if available
      if (userId && options.syncUserData) {
        options.userId = userId;
      }
      
      // Perform the sync
      const result = await syncLocalData(options);
      
      setLastSyncResult(result);
      setLastSyncTime(new Date());
      
      return result;
    } catch (error) {
      console.error('Sync error:', error);
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, checkSyncNeeds, userId]);

  // Auto-sync when coming back online
  useEffect(() => {
    let mounted = true;
    
    if (isOnline && mounted) {
      // Small delay to avoid immediate sync when the app loads
      const timer = setTimeout(() => {
        performSync();
      }, 1000);
      
      return () => {
        clearTimeout(timer);
        mounted = false;
      };
    }
    
    return () => {
      mounted = false;
    };
  }, [isOnline, performSync]);

  // Periodic sync check (every 15 minutes)
  useEffect(() => {
    let mounted = true;
    
    const interval = setInterval(() => {
      if (isOnline && mounted) {
        checkSyncNeeds().then(syncNeeds => {
          if (syncNeeds && 
              (syncNeeds.categories || 
               syncNeeds.brands || 
               syncNeeds.popularProducts)) {
            performSync({
              syncCategories: syncNeeds.categories,
              syncBrands: syncNeeds.brands,
              syncPopularProducts: syncNeeds.popularProducts,
              syncUserData: false
            });
          }
        });
      }
    }, 15 * 60 * 1000); // 15 minutes
    
    return () => {
      clearInterval(interval);
      mounted = false;
    };
  }, [isOnline, checkSyncNeeds, performSync]);

  return {
    isSyncing,
    lastSyncResult,
    lastSyncTime,
    performSync,
    checkSyncNeeds
  };
} 