import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { getCurrentUser } from './supabaseClient';

// Custom error types for different API scenarios
export class ProductServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductServiceError';
  }
}

export class ProductNotFoundError extends ProductServiceError {
  constructor(barcode: string) {
    super(`Product with barcode ${barcode} not found`);
    this.name = 'ProductNotFoundError';
  }
}

export class NetworkError extends ProductServiceError {
  public status?: number;
  public originalError?: Error;
  
  constructor(message: string, status?: number, originalError?: Error) {
    super(message);
    this.name = 'NetworkError';
    this.status = status;
    this.originalError = originalError;
  }
}

export class RateLimitError extends ProductServiceError {
  public retryAfter?: number;
  
  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class DatabaseError extends ProductServiceError {
  public originalError?: Error;
  
  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

export class CacheError extends ProductServiceError {
  constructor(message: string) {
    super(message);
    this.name = 'CacheError';
  }
}

// Add a new error class for validation errors
export class ValidationError extends ProductServiceError {
  public validationErrors: Record<string, string>;
  
  constructor(message: string, validationErrors: Record<string, string>) {
    super(message);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }
}

// Add a new error class for authentication errors
export class AuthenticationError extends ProductServiceError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Add a new error class for storage errors
export class StorageError extends ProductServiceError {
  public originalError?: Error;
  
  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = 'StorageError';
    this.originalError = originalError;
  }
}

// Add a new error class for queue operations
export class QueueError extends ProductServiceError {
  public originalError?: Error;
  
  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = 'QueueError';
    this.originalError = originalError;
  }
}

// Utility function for standardized error logging and reporting
export function logError(error: Error, context?: Record<string, unknown>): void {
  // Determine error type and log appropriately
  const errorType = error.name || 'UnknownError';
  const errorMessage = error.message || 'An unknown error occurred';
  
  // Create a structured error object for logging
  const logObject = {
    type: errorType,
    message: errorMessage,
    timestamp: new Date().toISOString(),
    context: context || {},
  };
  
  // Log to console for development
  console.error('Product Service Error:', logObject);
  
  // In a production environment, you might want to:
  // 1. Send to a monitoring service like Sentry
  // 2. Log to analytics
  // 3. Report to a backend error tracking endpoint
  
  // Example of how you might integrate with a monitoring service:
  // if (typeof Sentry !== 'undefined') {
  //   Sentry.captureException(error, { extra: context });
  // }
}

// Type for product data from Open Beauty Facts API
export interface OpenBeautyFactsProduct {
  code: string;
  product: {
    product_name: string;
    brands: string;
    image_url?: string;
    ingredients_text?: string;
    categories_tags?: string[];
    labels_tags?: string[];
    // Add more fields as needed based on the API response
  };
  status: number;
  status_verbose: string;
}

// Type for category data from Open Beauty Facts API
export interface Category {
  id: string;
  name: string;
  products: number;
  url: string;
}

// Type for brand data from Open Beauty Facts API
export interface Brand {
  id: string;
  name: string;
  products: number;
  url: string;
}

// Type for ingredient data from Open Beauty Facts API
export interface Ingredient {
  id: string;
  name: string;
  text: string;
  rank?: number;
  percent_min?: number;
  percent_max?: number;
  has_sub_ingredients?: boolean;
  vegan?: boolean;
  vegetarian?: boolean;
  from_palm_oil?: boolean;
}

// Type for popular products response
export interface PopularProductsResponse {
  count: number;
  page: number;
  page_size: number;
  products: OpenBeautyFactsProduct[];
  skip: number;
}

// Type for our application's product model
export interface Product {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  safety_score: number;
  tags?: string[];
  created_at?: string | null;
}

// Type for scan history
export interface ScanHistory {
  id: string;
  product_id: string;
  user_id: string;
  scanned_at: string | null;
  source?: 'cache' | 'database' | 'api';
  synced?: boolean;
  product?: Product;
}

// Type for cached product data
interface CachedProduct {
  product: Product;
  timestamp: number;
}

// Cache configuration
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_KEY_PREFIX = 'scani_product_';
const API_RATE_LIMIT_MS = 1000; // 1 second between API calls
let lastApiCallTime = 0;

// Cache keys for different API responses
const CACHE_KEY_CATEGORIES = 'scani_categories';
const CACHE_KEY_BRANDS = 'scani_brands';
const CACHE_KEY_POPULAR = 'scani_popular_products';
const CACHE_KEY_INGREDIENT_PREFIX = 'scani_ingredient_';

// Cache key for credentials
const CACHE_KEY_CREDENTIALS = 'scani_obf_credentials';

// Enhanced Storage interface
export interface StorageInterface {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<string[]>;
  multiGet(keys: string[]): Promise<Array<[string, string | null]>>;
  multiSet(keyValuePairs: Array<[string, string]>): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
  clear(): Promise<void>;
  getSize(): Promise<number>;
  cleanupOldItems(): Promise<void>;
}

// Storage configuration
const STORAGE_PREFIX = 'scani_';
const STORAGE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB limit for storage

// Enhanced Storage implementation
export const Storage: StorageInterface = {
  /**
   * Get an item from storage
   * @param key The key to get
   * @returns The value or null if not found
   */
  getItem: async (key: string): Promise<string | null> => {
    try {
      // Check if we're in a browser environment
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      } 
      
      // For React Native, use AsyncStorage if available
      if (typeof global !== 'undefined' && global.AsyncStorage) {
        return await global.AsyncStorage.getItem(key);
      }
      
      // Fallback to in-memory storage for testing or unsupported environments
      return MemoryStorage.getItem(key);
    } catch (error) {
      logError(new StorageError(`Failed to get item: ${key}`, error as Error), { key });
      return null;
    }
  },
  
  /**
   * Set an item in storage
   * @param key The key to set
   * @param value The value to set
   */
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      // Check storage size before setting
      if (await Storage.getSize() + value.length > STORAGE_SIZE_LIMIT) {
        // If we're over the limit, try to clean up old items
        await Storage.cleanupOldItems();
        
        // Check again after cleanup
        if (await Storage.getSize() + value.length > STORAGE_SIZE_LIMIT) {
          throw new StorageError('Storage size limit exceeded');
        }
      }
      
      // Check if we're in a browser environment
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        return;
      }
      
      // For React Native, use AsyncStorage if available
      if (typeof global !== 'undefined' && global.AsyncStorage) {
        await global.AsyncStorage.setItem(key, value);
        return;
      }
      
      // Fallback to in-memory storage
      MemoryStorage.setItem(key, value);
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to set item: ${key}`, error as Error);
    }
  },
  
  /**
   * Remove an item from storage
   * @param key The key to remove
   */
  removeItem: async (key: string): Promise<void> => {
    try {
      // Check if we're in a browser environment
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        return;
      }
      
      // For React Native, use AsyncStorage if available
      if (typeof global !== 'undefined' && global.AsyncStorage) {
        await global.AsyncStorage.removeItem(key);
        return;
      }
      
      // Fallback to in-memory storage
      MemoryStorage.removeItem(key);
    } catch (error) {
      logError(new StorageError(`Failed to remove item: ${key}`, error as Error), { key });
    }
  },
  
  /**
   * Get all keys in storage
   * @returns Array of keys
   */
  getAllKeys: async (): Promise<string[]> => {
    try {
      // Check if we're in a browser environment
      if (typeof localStorage !== 'undefined') {
        return Object.keys(localStorage).filter(key => key.startsWith(STORAGE_PREFIX));
      }
      
      // For React Native, use AsyncStorage if available
      if (typeof global !== 'undefined' && global.AsyncStorage) {
        const allKeys = await global.AsyncStorage.getAllKeys();
        return allKeys.filter(key => key.startsWith(STORAGE_PREFIX));
      }
      
      // Fallback to in-memory storage
      return MemoryStorage.getAllKeys();
    } catch (error) {
      logError(new StorageError('Failed to get all keys', error as Error));
      return [];
    }
  },
  
  /**
   * Get multiple items from storage
   * @param keys Array of keys to get
   * @returns Array of key-value pairs
   */
  multiGet: async (keys: string[]): Promise<Array<[string, string | null]>> => {
    try {
      // For React Native, use AsyncStorage if available
      if (typeof global !== 'undefined' && global.AsyncStorage) {
        return await global.AsyncStorage.multiGet(keys);
      }
      
      // For browser or fallback, get items one by one
      const result: Array<[string, string | null]> = [];
      for (const key of keys) {
        const value = await Storage.getItem(key);
        result.push([key, value]);
      }
      return result;
    } catch (error) {
      logError(new StorageError('Failed to multi-get items', error as Error), { keys });
      return keys.map(key => [key, null]);
    }
  },
  
  /**
   * Set multiple items in storage
   * @param keyValuePairs Array of key-value pairs to set
   */
  multiSet: async (keyValuePairs: Array<[string, string]>): Promise<void> => {
    try {
      // Calculate total size
      const totalSize = keyValuePairs.reduce((size, [_, value]) => size + value.length, 0);
      
      // Check storage size before setting
      if (await Storage.getSize() + totalSize > STORAGE_SIZE_LIMIT) {
        // If we're over the limit, try to clean up old items
        await Storage.cleanupOldItems();
        
        // Check again after cleanup
        if (await Storage.getSize() + totalSize > STORAGE_SIZE_LIMIT) {
          throw new StorageError('Storage size limit exceeded');
        }
      }
      
      // For React Native, use AsyncStorage if available
      if (typeof global !== 'undefined' && global.AsyncStorage) {
        await global.AsyncStorage.multiSet(keyValuePairs);
        return;
      }
      
      // For browser or fallback, set items one by one
      for (const [key, value] of keyValuePairs) {
        await Storage.setItem(key, value);
      }
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError('Failed to multi-set items', error as Error);
    }
  },
  
  /**
   * Remove multiple items from storage
   * @param keys Array of keys to remove
   */
  multiRemove: async (keys: string[]): Promise<void> => {
    try {
      // For React Native, use AsyncStorage if available
      if (typeof global !== 'undefined' && global.AsyncStorage) {
        await global.AsyncStorage.multiRemove(keys);
        return;
      }
      
      // For browser or fallback, remove items one by one
      for (const key of keys) {
        await Storage.removeItem(key);
      }
    } catch (error) {
      logError(new StorageError('Failed to multi-remove items', error as Error), { keys });
    }
  },
  
  /**
   * Clear all items from storage
   */
  clear: async (): Promise<void> => {
    try {
      // Get all keys that start with our prefix
      const keys = await Storage.getAllKeys();
      
      // Remove all keys
      await Storage.multiRemove(keys);
    } catch (error) {
      logError(new StorageError('Failed to clear storage', error as Error));
    }
  },
  
  /**
   * Get the current size of storage in bytes
   * @returns Size in bytes
   */
  getSize: async (): Promise<number> => {
    try {
      let totalSize = 0;
      
      // Get all keys
      const keys = await Storage.getAllKeys();
      
      // Get all values
      for (const key of keys) {
        const value = await Storage.getItem(key);
        if (value) {
          // Add key size and value size
          totalSize += key.length + value.length;
        }
      }
      
      return totalSize;
    } catch (error) {
      logError(new StorageError('Failed to get storage size', error as Error));
      return 0;
    }
  },
  
  /**
   * Clean up old items to free up storage space
   * Removes items based on timestamp, oldest first
   */
  cleanupOldItems: async (): Promise<void> => {
    try {
      // Get all keys
      const keys = await Storage.getAllKeys();
      
      // Get all cached items with timestamps
      const items: Array<{ key: string; timestamp: number }> = [];
      
      for (const key of keys) {
        const value = await Storage.getItem(key);
        if (value) {
          try {
            const parsed = JSON.parse(value);
            if (parsed.timestamp) {
              items.push({ key, timestamp: parsed.timestamp });
            }
          } catch (e) {
            // Skip items that can't be parsed
          }
        }
      }
      
      // Sort by timestamp (oldest first)
      items.sort((a, b) => a.timestamp - b.timestamp);
      
      // Remove oldest 20% of items
      const itemsToRemove = Math.ceil(items.length * 0.2);
      const keysToRemove = items.slice(0, itemsToRemove).map(item => item.key);
      
      await Storage.multiRemove(keysToRemove);
    } catch (error) {
      logError(new StorageError('Failed to clean up old items', error as Error));
    }
  }
};

// In-memory storage fallback for testing or unsupported environments
const MemoryStorage = {
  storage: new Map<string, string>(),
  
  getItem: (key: string): string | null => {
    return MemoryStorage.storage.get(key) || null;
  },
  
  setItem: (key: string, value: string): void => {
    MemoryStorage.storage.set(key, value);
  },
  
  removeItem: (key: string): void => {
    MemoryStorage.storage.delete(key);
  },
  
  getAllKeys: (): string[] => {
    return Array.from(MemoryStorage.storage.keys());
  }
};

/**
 * Save a product to the cache
 * @param product The product to cache
 */
async function saveToCache(product: Product): Promise<void> {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${product.barcode}`;
    const cacheData: CachedProduct = {
      product,
      timestamp: Date.now()
    };
    await Storage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to save product to cache:', error);
    // Continue execution even if caching fails
  }
}

/**
 * Get a product from the cache
 * @param barcode The product barcode
 * @returns The cached product or null if not found or expired
 */
async function getFromCache(barcode: string): Promise<Product | null> {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${barcode}`;
    const cachedData = await Storage.getItem(cacheKey);
    
    if (!cachedData) return null;
    
    const { product, timestamp }: CachedProduct = JSON.parse(cachedData);
    
    // Check if cache is expired
    if (Date.now() - timestamp > CACHE_EXPIRY_MS) {
      await Storage.removeItem(cacheKey);
      return null;
    }
    
    return product;
  } catch (error) {
    console.warn('Failed to retrieve product from cache:', error);
    return null;
  }
}

/**
 * Clear expired items from cache
 */
export async function cleanupCache(): Promise<void> {
  try {
    const now = Date.now();
    
    // Find all cache keys for our app
    const allKeys = await Storage.getAllKeys();
    const productKeys = allKeys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
    
    for (const key of productKeys) {
      const cachedData = await Storage.getItem(key);
      
      if (cachedData) {
        const { timestamp }: CachedProduct = JSON.parse(cachedData);
        
        if (now - timestamp > CACHE_EXPIRY_MS) {
          await Storage.removeItem(key);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to clean up cache:', error);
  }
}

/**
 * Enforce API rate limiting
 * @returns Promise that resolves when it's safe to make an API call
 */
async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const timeElapsed = now - lastApiCallTime;
  
  if (timeElapsed < API_RATE_LIMIT_MS && lastApiCallTime > 0) {
    const waitTime = API_RATE_LIMIT_MS - timeElapsed;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastApiCallTime = Date.now();
}

/**
 * Make a request to the Open Beauty Facts API
 * @param endpoint The API endpoint to call
 * @param params Optional query parameters
 * @returns The API response data
 */
async function makeApiRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  ProductDebug.log(`Making API request to endpoint: ${endpoint}`, params);
  ProductDebug.startTimer(`apiRequest-${endpoint}`);
  
  try {
    // Enforce rate limiting
    ProductDebug.log(`Enforcing rate limit before API request`);
    await enforceRateLimit();
    
    // Check network connectivity
    if (!navigator.onLine) {
      ProductDebug.log(`❌ No internet connection available`);
      throw new NetworkError('No internet connection available', undefined);
    }
    
    // Build URL with query parameters
    const url = new URL(`https://world.openbeautyfacts.org/api/v0/${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    
    ProductDebug.log(`Fetching from URL: ${url.toString()}`);
    const fetchStartTime = performance.now();
    const response = await fetch(url.toString());
    const fetchDuration = performance.now() - fetchStartTime;
    
    ProductDebug.log(`Fetch completed in ${fetchDuration.toFixed(2)}ms with status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      // Handle different HTTP error scenarios
      switch (response.status) {
        case 429: {
          // Rate limiting
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter) : 5;
          ProductDebug.log(`⚠️ API rate limit exceeded. Retry after ${waitTime} seconds.`);
          
          const error = new RateLimitError(
            `API rate limit exceeded. Retry after ${waitTime} seconds.`,
            waitTime
          );
          
          // Log the rate limit error
          logError(error, { endpoint, params, retryAfter: waitTime });
          
          // Wait and retry
          ProductDebug.log(`Waiting ${waitTime} seconds before retrying...`);
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
          ProductDebug.log(`Retrying API request after rate limit wait`);
          return makeApiRequest(endpoint, params);
        }
        
        case 404:
          ProductDebug.log(`❌ API endpoint not found: ${endpoint}`);
          throw new ProductServiceError(`API endpoint not found: ${endpoint}`);
          
        case 500:
        case 502:
        case 503:
        case 504:
          ProductDebug.log(`❌ API server error: ${response.status} ${response.statusText}`);
          throw new NetworkError(`API server error: ${response.statusText}`, response.status);
          
        default:
          ProductDebug.log(`❌ API request failed with status ${response.status}: ${response.statusText}`);
          throw new NetworkError(
            `API request failed with status ${response.status}: ${response.statusText}`,
            response.status
          );
      }
    }
    
    ProductDebug.log(`Parsing JSON response`);
    const jsonStartTime = performance.now();
    const data = await response.json();
    const jsonDuration = performance.now() - jsonStartTime;
    
    ProductDebug.log(`JSON parsing completed in ${jsonDuration.toFixed(2)}ms`);
    ProductDebug.log(`API response data:`, data);
    
    ProductDebug.endTimer(`apiRequest-${endpoint}`);
    return data as T;
  } catch (error) {
    // Handle different error types
    if (error instanceof ProductServiceError) {
      // Already a custom error, just log it
      ProductDebug.error(`Product service error in API request`, error);
      logError(error, { endpoint, params });
      throw error;
    } else if (error instanceof TypeError) {
      // Likely a network error or CORS issue
      ProductDebug.error(`Network error while making API request`, error);
      const networkError = new NetworkError(
        'Network error while making API request',
        undefined,
        error as Error
      );
      logError(networkError, { endpoint, params });
      throw networkError;
    } else {
      // Unknown error
      ProductDebug.error(`Unexpected error in API request`, error);
      const unknownError = new ProductServiceError(
        `Unexpected error in API request: ${(error as Error).message}`
      );
      logError(unknownError, { endpoint, params, originalError: error });
      throw unknownError;
    }
  } finally {
    if (ProductDebug.timers[`apiRequest-${endpoint}`]) {
      ProductDebug.endTimer(`apiRequest-${endpoint}`);
    }
  }
}

/**
 * Fetch product data from Open Beauty Facts API by barcode
 * @param barcode The product barcode to search for
 * @returns Promise with the product data or null if not found
 */
export async function fetchProductFromAPI(barcode: string): Promise<OpenBeautyFactsProduct | null> {
  ProductDebug.log(`Fetching product from API with barcode: ${barcode}`);
  ProductDebug.startTimer(`fetchProductFromAPI-${barcode}`);
  
  try {
    const apiUrl = `product/${barcode}.json`;
    ProductDebug.log(`Using API endpoint: ${apiUrl}`);
    
    const data = await makeApiRequest<OpenBeautyFactsProduct>(apiUrl);
    
    // Check if the product was found
    if (data.status === 0) {
      ProductDebug.log(`❌ Product not found in API response (status=0)`, data);
      throw new ProductNotFoundError(barcode);
    }
    
    // Verify the response structure
    if (!data.product) {
      ProductDebug.log(`❌ Invalid API response - missing product object`, data);
      throw new ProductServiceError(`Invalid API response for barcode ${barcode} - missing product object`);
    }
    
    // Check for essential fields
    const essentialFields = ['product_name', 'brands'];
    const missingFields = essentialFields.filter(field => !data.product[field]);
    
    if (missingFields.length > 0) {
      ProductDebug.log(`⚠️ API response missing essential fields: ${missingFields.join(', ')}`, data.product);
    }
    
    ProductDebug.log(`✅ Product successfully fetched from API`, {
      barcode,
      name: data.product.product_name,
      brand: data.product.brands,
      hasImage: !!data.product.image_url,
      categories: data.product.categories_tags?.length || 0
    });
    
    ProductDebug.endTimer(`fetchProductFromAPI-${barcode}`);
    return data;
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      ProductDebug.log(`Product not found in API: ${barcode}`);
      logError(error, { barcode });
      ProductDebug.endTimer(`fetchProductFromAPI-${barcode}`);
      return null;
    }
    
    ProductDebug.error(`Error fetching product from API: ${barcode}`, error);
    ProductDebug.endTimer(`fetchProductFromAPI-${barcode}`);
    throw error;
  }
}

/**
 * Fetch product categories from Open Beauty Facts API
 * @param limit The maximum number of categories to return
 * @returns Promise with the categories data
 */
export async function fetchCategories(limit = 100): Promise<Category[]> {
  try {
    // Try to get from cache first
    const cachedData = await Storage.getItem(CACHE_KEY_CATEGORIES);
    
    if (cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);
      
      // Check if cache is still valid (24 hours)
      if (Date.now() - timestamp < CACHE_EXPIRY_MS) {
        return data as Category[];
      }
    }
    
    // Fetch from API if not in cache or expired
    const response = await makeApiRequest<{ tags: Category[] }>('categories.json', {
      limit: limit.toString()
    });
    
    // Sort categories by product count (most popular first)
    const categories = response.tags.sort((a, b) => b.products - a.products);
    
    // Save to cache
    await Storage.setItem(CACHE_KEY_CATEGORIES, JSON.stringify({
      data: categories,
      timestamp: Date.now()
    }));
    
    return categories;
  } catch (error) {
    if (error instanceof ProductServiceError) {
      logError(error, { limit });
      throw error;
    } else {
      const serviceError = new ProductServiceError(
        `Error fetching categories: ${(error as Error).message}`
      );
      logError(serviceError, { limit });
      throw serviceError;
    }
  }
}

/**
 * Fetch product brands from Open Beauty Facts API
 * @param limit The maximum number of brands to return
 * @returns Promise with the brands data
 */
export async function fetchBrands(limit = 100): Promise<Brand[]> {
  try {
    // Try to get from cache first
    const cachedData = await Storage.getItem(CACHE_KEY_BRANDS);
    
    if (cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);
      
      // Check if cache is still valid (24 hours)
      if (Date.now() - timestamp < CACHE_EXPIRY_MS) {
        return data as Brand[];
      }
    }
    
    // Fetch from API if not in cache or expired
    const response = await makeApiRequest<{ tags: Brand[] }>('brands.json', {
      limit: limit.toString()
    });
    
    // Sort brands by product count (most popular first)
    const brands = response.tags.sort((a, b) => b.products - a.products);
    
    // Save to cache
    await Storage.setItem(CACHE_KEY_BRANDS, JSON.stringify({
      data: brands,
      timestamp: Date.now()
    }));
    
    return brands;
  } catch (error) {
    if (error instanceof ProductServiceError) {
      logError(error, { limit });
      throw error;
    } else {
      const serviceError = new ProductServiceError(
        `Error fetching brands: ${(error as Error).message}`
      );
      logError(serviceError, { limit });
      throw serviceError;
    }
  }
}

/**
 * Get detailed information about an ingredient
 * @param ingredientId The ingredient ID or name
 * @returns Promise with the ingredient data
 */
export async function getIngredientInfo(ingredientId: string): Promise<Ingredient | null> {
  try {
    // Normalize ingredient ID
    const normalizedId = ingredientId.toLowerCase().replace(/\s+/g, '-');
    
    // Try to get from cache first
    const cacheKey = `${CACHE_KEY_INGREDIENT_PREFIX}${normalizedId}`;
    const cachedData = await Storage.getItem(cacheKey);
    
    if (cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);
      
      // Check if cache is still valid (24 hours)
      if (Date.now() - timestamp < CACHE_EXPIRY_MS) {
        return data as Ingredient;
      }
    }
    
    // Fetch from API if not in cache or expired
    const response = await makeApiRequest<{ ingredient: Ingredient | null }>(`ingredient/${normalizedId}.json`);
    
    if (!response.ingredient) {
      return null;
    }
    
    // Save to cache
    await Storage.setItem(cacheKey, JSON.stringify({
      data: response.ingredient,
      timestamp: Date.now()
    }));
    
    return response.ingredient;
  } catch (error) {
    if (error instanceof ProductServiceError) {
      logError(error, { ingredientId });
      return null; // Return null instead of throwing for ingredient lookups
    } else {
      const serviceError = new ProductServiceError(
        `Error fetching ingredient info: ${(error as Error).message}`
      );
      logError(serviceError, { ingredientId });
      return null;
    }
  }
}

/**
 * Fetch popular products from Open Beauty Facts API
 * @param page The page number to fetch
 * @param pageSize The number of products per page
 * @param sortBy The field to sort by (default: popularity)
 * @returns Promise with the popular products data
 */
export async function fetchPopularProducts(
  page = 1,
  pageSize = 20,
  sortBy = 'popularity'
): Promise<PopularProductsResponse> {
  try {
    // For popular products, we use a shorter cache expiry (1 hour)
    const POPULAR_CACHE_EXPIRY = 60 * 60 * 1000;
    
    // Create a cache key that includes pagination and sorting
    const cacheKey = `${CACHE_KEY_POPULAR}_${page}_${pageSize}_${sortBy}`;
    
    // Try to get from cache first
    const cachedData = await Storage.getItem(cacheKey);
    
    if (cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);
      
      // Check if cache is still valid (1 hour)
      if (Date.now() - timestamp < POPULAR_CACHE_EXPIRY) {
        return data as PopularProductsResponse;
      }
    }
    
    // Fetch from API if not in cache or expired
    const response = await makeApiRequest<PopularProductsResponse>('products.json', {
      page: page.toString(),
      page_size: pageSize.toString(),
      sort_by: sortBy
    });
    
    // Save to cache
    await Storage.setItem(cacheKey, JSON.stringify({
      data: response,
      timestamp: Date.now()
    }));
    
    return response;
  } catch (error) {
    if (error instanceof ProductServiceError) {
      logError(error, { page, pageSize, sortBy });
      throw error;
    } else {
      const serviceError = new ProductServiceError(
        `Error fetching popular products: ${(error as Error).message}`
      );
      logError(serviceError, { page, pageSize, sortBy });
      throw serviceError;
    }
  }
}

/**
 * Search for products by query
 * @param query The search query
 * @param page The page number to fetch
 * @param pageSize The number of products per page
 * @returns Promise with the search results
 */
export async function searchProducts(
  query: string,
  page = 1,
  pageSize = 20
): Promise<PopularProductsResponse> {
  try {
    // Fetch from API (no caching for search results)
    return await makeApiRequest<PopularProductsResponse>('search.json', {
      search_terms: query,
      page: page.toString(),
      page_size: pageSize.toString()
    });
  } catch (error) {
    if (error instanceof ProductServiceError) {
      logError(error, { query, page, pageSize });
      throw error;
    } else {
      const serviceError = new ProductServiceError(
        `Error searching products: ${(error as Error).message}`
      );
      logError(serviceError, { query, page, pageSize });
      throw serviceError;
    }
  }
}

/**
 * Search for products by ingredient
 * @param ingredient The ingredient to search for
 * @param page The page number to fetch
 * @param pageSize The number of products per page
 * @returns Promise with the search results
 */
export async function searchProductsByIngredient(
  ingredient: string,
  page = 1,
  pageSize = 20
): Promise<PopularProductsResponse> {
  try {
    // Normalize ingredient name
    const normalizedIngredient = ingredient.toLowerCase().trim();
    
    // Fetch from API (no caching for search results)
    return await makeApiRequest<PopularProductsResponse>('search.json', {
      ingredients: normalizedIngredient,
      page: page.toString(),
      page_size: pageSize.toString()
    });
  } catch (error) {
    if (error instanceof ProductServiceError) {
      logError(error, { ingredient, page, pageSize });
      throw error;
    } else {
      const serviceError = new ProductServiceError(
        `Error searching products by ingredient: ${(error as Error).message}`
      );
      logError(serviceError, { ingredient, page, pageSize });
      throw serviceError;
    }
  }
}

/**
 * Save a product to the Supabase database
 * @param product The product data to save
 * @returns The saved product data
 */
export async function saveProductToDatabase(product: Omit<Product, 'id' | 'created_at'>): Promise<Product> {
  ProductDebug.log(`Saving product to database`, product);
  ProductDebug.startTimer(`saveProductToDatabase-${product.barcode}`);
  
  try {
    // Check if product already exists to prevent duplicates
    ProductDebug.log(`Checking if product already exists in database: ${product.barcode}`);
    const existingProduct = await getProductByBarcode(product.barcode);
    
    if (existingProduct) {
      // Product already exists, return it
      ProductDebug.log(`Product already exists in database, returning existing record`, existingProduct);
      ProductDebug.endTimer(`saveProductToDatabase-${product.barcode}`);
      return existingProduct;
    }
    
    // Product doesn't exist, insert it
    ProductDebug.log(`Product doesn't exist in database, inserting new record`);
    const { data, error } = await supabase
      .from('products')
      .insert([product])
      .select()
      .single();
    
    if (error) {
      ProductDebug.error(`Failed to save product to database`, error);
      throw new DatabaseError(`Failed to save product to database: ${error.message}`, error);
    }
    
    ProductDebug.log(`Product successfully saved to database with ID: ${data.id}`, data);
    
    // Save to cache
    ProductDebug.log(`Saving product to cache`);
    await saveToCache(data);
    
    ProductDebug.endTimer(`saveProductToDatabase-${product.barcode}`);
    return data;
  } catch (error) {
    ProductDebug.error(`Error saving product to database: ${product.barcode}`, error);
    ProductDebug.endTimer(`saveProductToDatabase-${product.barcode}`);
    throw error;
  }
}

/**
 * Get a product from the database by barcode
 * @param barcode The product barcode to search for
 * @returns The product data or null if not found
 */
export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', barcode)
      .single();
    
    if (error) {
      // If the error is because no rows were returned, return null
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new DatabaseError(`Failed to get product from database: ${error.message}`, error);
    }
    
    // If found, update the cache
    if (data) {
      await saveToCache(data);
    }
    
    return data;
  } catch (error) {
    if (error instanceof ProductServiceError) {
      // Already a custom error, just log it
      logError(error, { barcode });
      throw error;
    } else {
      // Convert to a DatabaseError
      const dbError = new DatabaseError(
        `Error getting product from database: ${(error as Error).message}`,
        error as Error
      );
      logError(dbError, { barcode });
      throw dbError;
    }
  }
}

/**
 * Get the current authenticated user's ID
 * @returns The user ID or null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    return user?.id || null;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
}

/**
 * Record a product scan in the database
 * @param productId The ID of the product that was scanned
 * @param userId The ID of the user who scanned the product (optional, will use authenticated user if not provided)
 * @param source The source from which the product was retrieved (cache, database, or api)
 * @returns The created scan record
 */
export async function recordScan(
  productId: string, 
  userId?: string | null, 
  source: 'cache' | 'database' | 'api' = 'database'
): Promise<ScanHistory> {
  try {
    // If userId is not provided or is null, get the current authenticated user's ID
    if (!userId) {
      userId = await getCurrentUserId();
      
      // If still no user ID, throw an authentication error
      if (!userId) {
        throw new AuthenticationError('User must be authenticated to record a scan');
      }
    }
    
    const { data, error } = await supabase
      .from('scans')
      .insert([
        {
          product_id: productId,
          user_id: userId,
          scanned_at: new Date().toISOString(),
          source: source,
          synced: true
        },
      ])
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error recording scan:', error);
    throw new DatabaseError(`Failed to record scan for product ${productId}`, error instanceof Error ? error : undefined);
  }
}

/**
 * Get scan history for a user
 * @param userId The ID of the user
 * @param limit The maximum number of scans to return
 * @returns Array of scan records with product data
 */
export async function getUserScanHistory(userId: string, limit = 10): Promise<ScanHistory[]> {
  try {
    const { data, error } = await supabase
      .from('scans')
      .select(`
        *,
        product:products(*)
      `)
      .eq('user_id', userId)
      .order('scanned_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    // Update cache with products from scan history
    if (data && data.length > 0) {
      for (const scan of data) {
        if (scan.product) {
          await saveToCache(scan.product);
        }
      }
    }
    
    return data;
  } catch (error) {
    console.error('Error getting user scan history:', error);
    throw error;
  }
}

/**
 * Process a barcode scan, looking up the product in various sources
 * @param barcode The barcode to process
 * @param userId Optional user ID (will use authenticated user if not provided)
 * @returns The product and scan record
 */
export async function processBarcodeScan(
  barcode: string,
  userId?: string
): Promise<{ product: Product; scan: ScanHistory | undefined; source: string }> {
  ProductDebug.log(`Processing barcode scan: ${barcode}`, { userId });
  ProductDebug.startTimer('processBarcodeScan');
  
  // Check if we're online
  const isOnline = isNetworkAvailable();
  ProductDebug.log(`Network status: ${isOnline ? 'Online' : 'Offline'}`);
  
  // Try to get the product from various sources
  let product: Product | null = null;
  let productSource = '';
  
  // First try cache
  ProductDebug.log(`Step 1: Checking cache for barcode: ${barcode}`);
  ProductDebug.startTimer('cacheCheck');
  product = await getFromCache(barcode);
  ProductDebug.endTimer('cacheCheck');
  
  if (product) {
    productSource = 'cache';
    ProductDebug.log(`✅ Product found in cache`, product);
    console.log('Product found in cache', { barcode });
  } else {
    ProductDebug.log(`❌ Product not found in cache`);
  }
  
  // Then try database
  if (!product && isOnline) {
    ProductDebug.log(`Step 2: Checking database for barcode: ${barcode}`);
    ProductDebug.startTimer('databaseCheck');
    try {
      product = await getProductByBarcode(barcode);
      ProductDebug.endTimer('databaseCheck');
      
      if (product) {
        productSource = 'database';
        ProductDebug.log(`✅ Product found in database`, product);
        console.log('Product found in database', { barcode });
      } else {
        ProductDebug.log(`❌ Product not found in database`);
      }
    } catch (error) {
      ProductDebug.endTimer('databaseCheck');
      // Handle database errors
      if (error instanceof DatabaseError) {
        ProductDebug.error(`Database error when fetching product`, error);
        console.warn('Database error when fetching product', { barcode, error: error instanceof Error ? error.message : String(error) });
      } else {
        ProductDebug.error(`Unexpected error when fetching from database`, error);
        throw error;
      }
    }
  } else if (!product) {
    ProductDebug.log(`Skipping database check - offline`);
  }
  
  // Finally try API
  if (!product && isOnline) {
    ProductDebug.log(`Step 3: Checking API for barcode: ${barcode}`);
    ProductDebug.startTimer('apiCheck');
    try {
      const apiProduct = await fetchProductFromAPI(barcode);
      
      if (apiProduct) {
        productSource = 'api';
        ProductDebug.log(`✅ Product found in API`, apiProduct);
        console.log('Product found in API', { barcode });
        
        // Convert API product to our Product format
        const safetyScore = calculateSafetyScore(apiProduct);
        ProductDebug.log(`Calculated safety score: ${safetyScore}`);
        
        // Save to database
        ProductDebug.log(`Saving product to database`);
        ProductDebug.startTimer('saveToDatabase');
        
        const productToSave = {
          barcode,
          name: apiProduct.product.product_name || 'Unknown Product',
          brand: apiProduct.product.brands || 'Unknown Brand',
          safety_score: safetyScore,
          tags: apiProduct.product.categories_tags || []
        };
        
        ProductDebug.log(`Product data to save:`, productToSave);
        product = await saveProductToDatabase(productToSave);
        ProductDebug.endTimer('saveToDatabase');
        ProductDebug.log(`Product saved to database with ID: ${product.id}`);
      } else {
        ProductDebug.log(`❌ Product not found in API`);
      }
      
      ProductDebug.endTimer('apiCheck');
    } catch (error) {
      ProductDebug.endTimer('apiCheck');
      // Handle API errors
      if (error instanceof NetworkError) {
        ProductDebug.error(`Network error when fetching product from API`, error);
        console.warn('Network error when fetching product from API', { barcode, error: error instanceof Error ? error.message : String(error) });
      } else if (error instanceof ProductNotFoundError) {
        ProductDebug.log(`Product not found in API: ${barcode}`);
        console.warn('Product not found in API', { barcode });
      } else {
        ProductDebug.error(`Unexpected error when fetching from API`, error);
        throw error;
      }
    }
  } else if (!product) {
    ProductDebug.log(`Skipping API check - ${isOnline ? 'product already found' : 'offline'}`);
  }
  
  // If product not found in any source, throw error
  if (!product) {
    ProductDebug.log(`❌ Product not found in any source, throwing ProductNotFoundError`);
    throw new ProductNotFoundError(`Product with barcode ${barcode} not found`);
  }
  
  // If product was found in database or API, add to cache
  if (productSource === 'database' || productSource === 'api') {
    ProductDebug.log(`Saving product to cache`);
    ProductDebug.startTimer('saveToCache');
    await saveToCache(product);
    ProductDebug.endTimer('saveToCache');
  }
  
  // Record the scan with offline support
  ProductDebug.log(`Recording scan with offline support`);
  ProductDebug.startTimer('recordScan');
  const scanResult = await recordScanWithOfflineSupport(product.id, userId);
  ProductDebug.endTimer('recordScan');
  ProductDebug.log(`Scan recorded`, scanResult);
  
  // Randomly clean up expired cache items (1% chance)
  if (Math.random() < 0.01) {
    ProductDebug.log(`Cleaning up expired cache items`);
    cleanupCache().catch(error => {
      ProductDebug.error(`Error cleaning up cache`, error);
      logError(error instanceof Error ? error : new Error(String(error)), { context: 'cleanupCache' });
    });
  }
  
  const result = {
    product,
    scan: scanResult.scan,
    source: productSource
  };
  
  ProductDebug.log(`Process completed. Product source: ${productSource}`);
  ProductDebug.endTimer('processBarcodeScan');
  
  return result;
}

/**
 * Calculate a safety score based on product ingredients and labels
 * This is a placeholder implementation - you'll want to implement your own scoring logic
 * @param product The product data from Open Beauty Facts
 * @returns A safety score between 0-100
 */
export function calculateSafetyScore(product: OpenBeautyFactsProduct): number {
  // This is a simplified placeholder implementation
  // In a real app, you would analyze ingredients, certifications, etc.
  
  const hasIngredients = !!product.product.ingredients_text;
  const labelCount = product.product.labels_tags?.length || 0;
  
  // Simple scoring logic - replace with your own algorithm
  let score = 50; // Default middle score
  
  if (hasIngredients) score += 10;
  score += Math.min(labelCount * 5, 30); // Max 30 points from labels
  
  // Ensure score is between 0-100
  return Math.max(0, Math.min(100, score));
}

// Type for product contribution data
export interface ProductContribution {
  code: string;
  product_name: string;
  brands: string;
  quantity?: string;
  packaging?: string;
  categories?: string;
  labels?: string;
  ingredients_text?: string;
  image_url?: string;
}

// Type for product update data
export interface ProductUpdate extends Partial<ProductContribution> {
  code: string; // Barcode is always required for updates
}

// Type for authentication credentials
export interface OpenFoodFactsCredentials {
  username: string;
  password: string;
}

/**
 * Validate product data before submission
 * @param product The product data to validate
 * @returns Validation errors or null if valid
 */
function validateProductData(product: ProductContribution): Record<string, string> | null {
  const errors: Record<string, string> = {};
  
  // Required fields
  if (!product.code) {
    errors.code = 'Barcode is required';
  } else if (!/^\d{8,14}$/.test(product.code)) {
    errors.code = 'Barcode must be 8-14 digits';
  }
  
  if (!product.product_name || product.product_name.trim().length === 0) {
    errors.product_name = 'Product name is required';
  }
  
  if (!product.brands || product.brands.trim().length === 0) {
    errors.brands = 'Brand name is required';
  }
  
  // Optional fields validation
  if (product.quantity && product.quantity.trim().length > 100) {
    errors.quantity = 'Quantity is too long (max 100 characters)';
  }
  
  // Return null if no errors, otherwise return the errors object
  return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * Store Open Beauty Facts credentials securely
 * @param credentials The credentials to store
 */
export async function storeCredentials(credentials: OpenFoodFactsCredentials): Promise<void> {
  try {
    // In a real app, you would want to encrypt these credentials
    // For now, we'll just store them in the cache
    await Storage.setItem(CACHE_KEY_CREDENTIALS, JSON.stringify(credentials));
  } catch (error) {
    console.warn('Failed to store credentials:', error);
    throw new CacheError('Failed to store credentials');
  }
}

/**
 * Get stored Open Beauty Facts credentials
 * @returns The stored credentials or null if not found
 */
async function getCredentials(): Promise<OpenFoodFactsCredentials | null> {
  try {
    const credentialsJson = await Storage.getItem(CACHE_KEY_CREDENTIALS);
    if (!credentialsJson) return null;
    
    return JSON.parse(credentialsJson) as OpenFoodFactsCredentials;
  } catch (error) {
    console.warn('Failed to retrieve credentials:', error);
    return null;
  }
}

/**
 * Clear stored Open Beauty Facts credentials
 */
export async function clearCredentials(): Promise<void> {
  try {
    await Storage.removeItem(CACHE_KEY_CREDENTIALS);
  } catch (error) {
    console.warn('Failed to clear credentials:', error);
  }
}

/**
 * Submit a new product to the Open Beauty Facts database
 * @param product The product data to submit
 * @param credentials Optional credentials (if not provided, stored credentials will be used)
 * @returns The API response
 */
export async function submitNewProduct(
  product: ProductContribution,
  credentials?: OpenFoodFactsCredentials
): Promise<{ status: string; statusCode: number; message: string }> {
  try {
    // Validate product data
    const validationErrors = validateProductData(product);
    if (validationErrors) {
      throw new ValidationError('Invalid product data', validationErrors);
    }
    
    // Get credentials
    const creds = credentials || await getCredentials();
    if (!creds) {
      throw new AuthenticationError('Authentication credentials are required to submit products');
    }
    
    // Check network connectivity
    if (!navigator.onLine) {
      throw new NetworkError('No internet connection available', undefined);
    }
    
    // Enforce rate limiting
    await enforceRateLimit();
    
    // Prepare form data for submission
    const formData = new FormData();
    
    // Add authentication
    formData.append('user_id', creds.username);
    formData.append('password', creds.password);
    
    // Add product data
    formData.append('code', product.code);
    formData.append('product_name', product.product_name);
    formData.append('brands', product.brands);
    
    // Add optional fields if provided
    if (product.quantity) formData.append('quantity', product.quantity);
    if (product.packaging) formData.append('packaging', product.packaging);
    if (product.categories) formData.append('categories', product.categories);
    if (product.labels) formData.append('labels', product.labels);
    if (product.ingredients_text) formData.append('ingredients_text', product.ingredients_text);
    
    // Make the API request
    const response = await fetch('https://world.openbeautyfacts.org/cgi/product_jqm2.pl', {
      method: 'POST',
      body: formData,
    });
    
    // Handle response
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AuthenticationError('Invalid credentials or insufficient permissions');
      }
      
      throw new NetworkError(
        `API request failed with status ${response.status}: ${response.statusText}`,
        response.status
      );
    }
    
    const result = await response.json();
    
    // Check for API-level errors
    if (result.status !== 'ok') {
      throw new ProductServiceError(`API error: ${result.status_verbose || 'Unknown error'}`);
    }
    
    return {
      status: 'success',
      statusCode: response.status,
      message: result.status_verbose || 'Product submitted successfully',
    };
  } catch (error) {
    if (error instanceof ProductServiceError) {
      // Already a custom error, just log it
      logError(error, { product });
      throw error;
    } else {
      // Unknown error
      const serviceError = new ProductServiceError(
        `Error submitting product: ${(error as Error).message}`
      );
      logError(serviceError, { product });
      throw serviceError;
    }
  }
}

/**
 * Update an existing product in the Open Beauty Facts database
 * @param update The product update data
 * @param credentials Optional credentials (if not provided, stored credentials will be used)
 * @returns The API response
 */
export async function updateExistingProduct(
  update: ProductUpdate,
  credentials?: OpenFoodFactsCredentials
): Promise<{ status: string; statusCode: number; message: string }> {
  try {
    // Validate the barcode
    if (!update.code) {
      throw new ValidationError('Invalid product data', { code: 'Barcode is required' });
    } else if (!/^\d{8,14}$/.test(update.code)) {
      throw new ValidationError('Invalid product data', { code: 'Barcode must be 8-14 digits' });
    }
    
    // Ensure at least one field to update is provided
    const updateFields = Object.keys(update).filter(key => key !== 'code');
    if (updateFields.length === 0) {
      throw new ValidationError('Invalid product data', { 
        general: 'At least one field to update must be provided' 
      });
    }
    
    // Get credentials
    const creds = credentials || await getCredentials();
    if (!creds) {
      throw new AuthenticationError('Authentication credentials are required to update products');
    }
    
    // Check network connectivity
    if (!navigator.onLine) {
      throw new NetworkError('No internet connection available', undefined);
    }
    
    // Enforce rate limiting
    await enforceRateLimit();
    
    // Prepare form data for submission
    const formData = new FormData();
    
    // Add authentication
    formData.append('user_id', creds.username);
    formData.append('password', creds.password);
    
    // Add product code (barcode)
    formData.append('code', update.code);
    
    // Add fields to update
    Object.entries(update).forEach(([key, value]) => {
      if (key !== 'code' && value !== undefined) {
        formData.append(key, value);
      }
    });
    
    // Make the API request
    const response = await fetch('https://world.openbeautyfacts.org/cgi/product_jqm2.pl', {
      method: 'POST',
      body: formData,
    });
    
    // Handle response
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AuthenticationError('Invalid credentials or insufficient permissions');
      }
      
      throw new NetworkError(
        `API request failed with status ${response.status}: ${response.statusText}`,
        response.status
      );
    }
    
    const result = await response.json();
    
    // Check for API-level errors
    if (result.status !== 'ok') {
      throw new ProductServiceError(`API error: ${result.status_verbose || 'Unknown error'}`);
    }
    
    return {
      status: 'success',
      statusCode: response.status,
      message: result.status_verbose || 'Product updated successfully',
    };
  } catch (error) {
    if (error instanceof ProductServiceError) {
      // Already a custom error, just log it
      logError(error, { update });
      throw error;
    } else {
      // Unknown error
      const serviceError = new ProductServiceError(
        `Error updating product: ${(error as Error).message}`
      );
      logError(serviceError, { update });
      throw serviceError;
    }
  }
}

/**
 * Upload a product image to the Open Beauty Facts database
 * @param barcode The product barcode
 * @param imageFile The image file to upload
 * @param imageType The type of image (front, ingredients, nutrition, etc.)
 * @param credentials Optional credentials (if not provided, stored credentials will be used)
 * @returns The API response
 */
export async function uploadProductImage(
  barcode: string,
  imageFile: File,
  imageType: 'front' | 'ingredients' | 'nutrition' | 'packaging' | 'other' = 'front',
  credentials?: OpenFoodFactsCredentials
): Promise<{ status: string; statusCode: number; message: string; imageUrl?: string }> {
  try {
    // Validate barcode
    if (!barcode || !/^\d{8,14}$/.test(barcode)) {
      throw new ValidationError('Invalid barcode', { code: 'Barcode must be 8-14 digits' });
    }
    
    // Validate image file
    if (!imageFile) {
      throw new ValidationError('Invalid image', { image: 'Image file is required' });
    }
    
    // Check file type
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validImageTypes.includes(imageFile.type)) {
      throw new ValidationError('Invalid image', { 
        image: 'Image must be JPEG, PNG, or GIF' 
      });
    }
    
    // Check file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (imageFile.size > MAX_FILE_SIZE) {
      throw new ValidationError('Invalid image', { 
        image: 'Image file is too large (max 10MB)' 
      });
    }
    
    // Get credentials
    const creds = credentials || await getCredentials();
    if (!creds) {
      throw new AuthenticationError('Authentication credentials are required to upload images');
    }
    
    // Check network connectivity
    if (!navigator.onLine) {
      throw new NetworkError('No internet connection available', undefined);
    }
    
    // Enforce rate limiting
    await enforceRateLimit();
    
    // Prepare form data for submission
    const formData = new FormData();
    
    // Add authentication
    formData.append('user_id', creds.username);
    formData.append('password', creds.password);
    
    // Add product code (barcode)
    formData.append('code', barcode);
    
    // Add image type
    formData.append('imagefield', imageType);
    
    // Add image file
    formData.append('imgupload_' + imageType, imageFile);
    
    // Make the API request
    const response = await fetch('https://world.openbeautyfacts.org/cgi/product_image_upload.pl', {
      method: 'POST',
      body: formData,
    });
    
    // Handle response
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AuthenticationError('Invalid credentials or insufficient permissions');
      }
      
      throw new NetworkError(
        `API request failed with status ${response.status}: ${response.statusText}`,
        response.status
      );
    }
    
    const result = await response.json();
    
    // Check for API-level errors
    if (result.status !== 'ok') {
      throw new ProductServiceError(`API error: ${result.status_verbose || 'Unknown error'}`);
    }
    
    return {
      status: 'success',
      statusCode: response.status,
      message: result.status_verbose || 'Image uploaded successfully',
      imageUrl: result.image_url,
    };
  } catch (error) {
    if (error instanceof ProductServiceError) {
      // Already a custom error, just log it
      logError(error, { barcode, imageType });
      throw error;
    } else {
      // Unknown error
      const serviceError = new ProductServiceError(
        `Error uploading product image: ${(error as Error).message}`
      );
      logError(serviceError, { barcode, imageType });
      throw serviceError;
    }
  }
}

/**
 * Check if the user has valid credentials for Open Beauty Facts
 * @param credentials Optional credentials to check (if not provided, stored credentials will be used)
 * @returns Whether the credentials are valid
 */
export async function checkCredentials(
  credentials?: OpenFoodFactsCredentials
): Promise<boolean> {
  try {
    // Get credentials
    const creds = credentials || await getCredentials();
    if (!creds) {
      return false;
    }
    
    // Check network connectivity
    if (!navigator.onLine) {
      throw new NetworkError('No internet connection available', undefined);
    }
    
    // Enforce rate limiting
    await enforceRateLimit();
    
    // Prepare form data for submission
    const formData = new FormData();
    
    // Add authentication
    formData.append('user_id', creds.username);
    formData.append('password', creds.password);
    
    // Make a simple API request to check credentials
    const response = await fetch('https://world.openbeautyfacts.org/cgi/session.pl', {
      method: 'POST',
      body: formData,
    });
    
    // If response is OK, credentials are valid
    return response.ok;
  } catch (error) {
    // Log the error but don't throw
    logError(error as Error, { action: 'checkCredentials' });
    return false;
  }
}

// Operation types for the queue
export enum OperationType {
  SUBMIT_PRODUCT = 'SUBMIT_PRODUCT',
  UPDATE_PRODUCT = 'UPDATE_PRODUCT',
  UPLOAD_IMAGE = 'UPLOAD_IMAGE',
  RECORD_SCAN = 'RECORD_SCAN',
  CUSTOM = 'CUSTOM'
}

// Operation status
export enum OperationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRY = 'RETRY'
}

// Operation interface
export interface QueuedOperation {
  id: string;
  type: OperationType;
  data: any;
  status: OperationStatus;
  createdAt: number;
  updatedAt: number;
  retryCount: number;
  maxRetries: number;
  nextRetryTime?: number;
  error?: string;
}

// Queue configuration
const QUEUE_STORAGE_KEY = 'scani_operation_queue';
const DEFAULT_MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 60 * 60 * 1000; // 1 hour

// Network status monitoring
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let networkListenersInitialized = false;
let queueProcessorRunning = false;
let queueProcessorTimeout: ReturnType<typeof setTimeout> | null = null;

// Queue event callbacks
type QueueEventCallback = (operation: QueuedOperation) => void;
const queueEventListeners: Record<string, QueueEventCallback[]> = {
  'operationAdded': [],
  'operationUpdated': [],
  'operationCompleted': [],
  'operationFailed': [],
  'queueProcessingStarted': [],
  'queueProcessingCompleted': [],
  'networkStatusChanged': []
};

/**
 * Initialize network status monitoring
 */
function initNetworkListeners(): void {
  if (networkListenersInitialized || typeof window === 'undefined') {
    return;
  }
  
  // Set initial online status
  isOnline = navigator.onLine;
  
  // Add event listeners for online/offline events
  window.addEventListener('online', handleNetworkStatusChange);
  window.addEventListener('offline', handleNetworkStatusChange);
  
  networkListenersInitialized = true;
}

/**
 * Handle network status changes
 */
function handleNetworkStatusChange(): void {
  const wasOnline = isOnline;
  isOnline = navigator.onLine;
  
  // If we just came online, process the queue
  if (!wasOnline && isOnline) {
    processOperationQueue();
  }
  
  // Notify listeners of network status change
  notifyQueueEventListeners('networkStatusChanged', {
    id: 'network-status',
    type: OperationType.CUSTOM,
    data: { isOnline },
    status: OperationStatus.COMPLETED,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    retryCount: 0,
    maxRetries: 0
  });
}

/**
 * Check if the device is currently online
 * @returns Whether the device is online
 */
export function isNetworkAvailable(): boolean {
  // Initialize network listeners if not already done
  if (!networkListenersInitialized) {
    initNetworkListeners();
  }
  
  return isOnline;
}

/**
 * Add an event listener for queue events
 * @param event The event to listen for
 * @param callback The callback to execute
 */
export function addQueueEventListener(
  event: 'operationAdded' | 'operationUpdated' | 'operationCompleted' | 'operationFailed' | 'queueProcessingStarted' | 'queueProcessingCompleted' | 'networkStatusChanged',
  callback: QueueEventCallback
): void {
  if (queueEventListeners[event]) {
    queueEventListeners[event].push(callback);
  }
}

/**
 * Remove an event listener for queue events
 * @param event The event to stop listening for
 * @param callback The callback to remove
 */
export function removeQueueEventListener(
  event: string,
  callback: QueueEventCallback
): void {
  if (queueEventListeners[event]) {
    queueEventListeners[event] = queueEventListeners[event].filter(cb => cb !== callback);
  }
}

/**
 * Notify all listeners of a queue event
 * @param event The event that occurred
 * @param operation The operation related to the event
 */
function notifyQueueEventListeners(event: string, operation: QueuedOperation): void {
  if (queueEventListeners[event]) {
    queueEventListeners[event].forEach(callback => {
      try {
        callback(operation);
      } catch (error) {
        logError(new QueueError(`Error in queue event listener for ${event}`, error as Error), {
          event,
          operationId: operation.id
        });
      }
    });
  }
}

/**
 * Get the current operation queue
 * @returns The current queue of operations
 */
export async function getOperationQueue(): Promise<QueuedOperation[]> {
  try {
    const queueData = await Storage.getItem(QUEUE_STORAGE_KEY);
    if (!queueData) {
      return [];
    }
    
    return JSON.parse(queueData) as QueuedOperation[];
  } catch (error) {
    logError(new QueueError('Failed to get operation queue', error as Error));
    return [];
  }
}

/**
 * Save the operation queue
 * @param queue The queue to save
 */
async function saveOperationQueue(queue: QueuedOperation[]): Promise<void> {
  try {
    await Storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    logError(new QueueError('Failed to save operation queue', error as Error), { queueSize: queue.length });
  }
}

/**
 * Add an operation to the queue
 * @param type The type of operation
 * @param data The data for the operation
 * @param options Optional configuration for the operation
 * @returns The queued operation
 */
export async function enqueueOperation(
  type: OperationType,
  data: any,
  options: { maxRetries?: number } = {}
): Promise<QueuedOperation> {
  // Initialize network listeners if not already done
  if (!networkListenersInitialized) {
    initNetworkListeners();
  }
  
  // Create the operation
  const operation: QueuedOperation = {
    id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type,
    data,
    status: OperationStatus.PENDING,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    retryCount: 0,
    maxRetries: options.maxRetries !== undefined ? options.maxRetries : DEFAULT_MAX_RETRIES
  };
  
  // Get the current queue
  const queue = await getOperationQueue();
  
  // Add the operation to the queue
  queue.push(operation);
  
  // Save the updated queue
  await saveOperationQueue(queue);
  
  // Notify listeners
  notifyQueueEventListeners('operationAdded', operation);
  
  // If we're online, process the queue immediately
  if (isNetworkAvailable()) {
    processOperationQueue();
  }
  
  return operation;
}

/**
 * Update an operation in the queue
 * @param operationId The ID of the operation to update
 * @param updates The updates to apply
 * @returns The updated operation or null if not found
 */
export async function updateOperation(
  operationId: string,
  updates: Partial<QueuedOperation>
): Promise<QueuedOperation | null> {
  // Get the current queue
  const queue = await getOperationQueue();
  
  // Find the operation
  const index = queue.findIndex(op => op.id === operationId);
  if (index === -1) {
    return null;
  }
  
  // Update the operation
  const operation = {
    ...queue[index],
    ...updates,
    updatedAt: Date.now()
  };
  
  // Replace the operation in the queue
  queue[index] = operation;
  
  // Save the updated queue
  await saveOperationQueue(queue);
  
  // Notify listeners
  notifyQueueEventListeners('operationUpdated', operation);
  
  return operation;
}

/**
 * Remove an operation from the queue
 * @param operationId The ID of the operation to remove
 * @returns Whether the operation was removed
 */
export async function removeOperation(operationId: string): Promise<boolean> {
  // Get the current queue
  const queue = await getOperationQueue();
  
  // Find the operation
  const index = queue.findIndex(op => op.id === operationId);
  if (index === -1) {
    return false;
  }
  
  // Remove the operation from the queue
  const [removedOperation] = queue.splice(index, 1);
  
  // Save the updated queue
  await saveOperationQueue(queue);
  
  // Notify listeners
  notifyQueueEventListeners('operationUpdated', {
    ...removedOperation,
    status: OperationStatus.COMPLETED,
    updatedAt: Date.now()
  });
  
  return true;
}

/**
 * Clear all operations from the queue
 * @returns The number of operations cleared
 */
export async function clearOperationQueue(): Promise<number> {
  // Get the current queue
  const queue = await getOperationQueue();
  const count = queue.length;
  
  // Clear the queue
  await saveOperationQueue([]);
  
  return count;
}

/**
 * Calculate the next retry time using exponential backoff
 * @param retryCount The current retry count
 * @returns The delay in milliseconds before the next retry
 */
function calculateBackoffDelay(retryCount: number): number {
  // Exponential backoff: 2^retryCount * initial delay, with jitter
  const exponentialDelay = Math.min(
    INITIAL_RETRY_DELAY * Math.pow(2, retryCount) * (0.8 + Math.random() * 0.4),
    MAX_RETRY_DELAY
  );
  
  return exponentialDelay;
}

/**
 * Process a single operation
 * @param operation The operation to process
 * @returns Whether the operation was processed successfully
 */
async function processOperation(operation: QueuedOperation): Promise<boolean> {
  try {
    // Update operation status to in progress
    await updateOperation(operation.id, { status: OperationStatus.IN_PROGRESS });
    
    // Process based on operation type
    switch (operation.type) {
      case OperationType.SUBMIT_PRODUCT:
        await submitNewProduct(operation.data.product, operation.data.credentials);
        break;
        
      case OperationType.UPDATE_PRODUCT:
        await updateExistingProduct(operation.data.update, operation.data.credentials);
        break;
        
      case OperationType.UPLOAD_IMAGE:
        await uploadProductImage(
          operation.data.barcode,
          operation.data.imageFile,
          operation.data.imageType,
          operation.data.credentials
        );
        break;
        
      case OperationType.RECORD_SCAN:
        // Check if we have a pending-auth userId that needs to be replaced with the current user
        let userId = operation.data.userId;
        if (userId === 'pending-auth') {
          // Get the current authenticated user
          userId = await getCurrentUserId();
          
          // If we still don't have a valid user ID, we can't process this operation
          if (!userId) {
            throw new AuthenticationError('User must be authenticated to process scan operation');
          }
        }
        
        await recordScan(operation.data.productId, userId);
        break;
        
      case OperationType.CUSTOM:
        // For custom operations, the data should include a process function
        if (typeof operation.data.process === 'function') {
          await operation.data.process();
        } else {
          throw new QueueError('Custom operation missing process function');
        }
        break;
        
      default:
        throw new QueueError(`Unknown operation type: ${operation.type}`);
    }
    
    // Operation completed successfully
    await updateOperation(operation.id, { status: OperationStatus.COMPLETED });
    notifyQueueEventListeners('operationCompleted', {
      ...operation,
      status: OperationStatus.COMPLETED,
      updatedAt: Date.now()
    });
    
    return true;
  } catch (error) {
    // Handle operation failure
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Determine if we should retry
    if (operation.retryCount < operation.maxRetries) {
      // Calculate next retry time with exponential backoff
      const backoffDelay = calculateBackoffDelay(operation.retryCount);
      const nextRetryTime = Date.now() + backoffDelay;
      
      // Update operation for retry
      await updateOperation(operation.id, {
        status: OperationStatus.RETRY,
        retryCount: operation.retryCount + 1,
        nextRetryTime,
        error: errorMessage
      });
      
      logError(new QueueError(`Operation ${operation.id} failed, will retry in ${Math.round(backoffDelay / 1000)}s`, error as Error), {
        operationType: operation.type,
        retryCount: operation.retryCount + 1,
        maxRetries: operation.maxRetries
      });
    } else {
      // Max retries reached, mark as failed
      await updateOperation(operation.id, {
        status: OperationStatus.FAILED,
        error: errorMessage
      });
      
      notifyQueueEventListeners('operationFailed', {
        ...operation,
        status: OperationStatus.FAILED,
        error: errorMessage,
        updatedAt: Date.now()
      });
      
      logError(new QueueError(`Operation ${operation.id} failed permanently after ${operation.maxRetries} retries`, error as Error), {
        operationType: operation.type,
        data: operation.data
      });
    }
    
    return false;
  }
}

/**
 * Process the operation queue
 * @param force Whether to force processing even if offline
 * @returns The number of operations processed
 */
export async function processOperationQueue(force: boolean = false): Promise<number> {
  // Check if already running
  if (queueProcessorRunning) {
    return 0;
  }
  
  // Check network availability
  if (!force && !isNetworkAvailable()) {
    return 0;
  }
  
  // Clear any existing timeout
  if (queueProcessorTimeout) {
    clearTimeout(queueProcessorTimeout);
    queueProcessorTimeout = null;
  }
  
  try {
    queueProcessorRunning = true;
    
    // Get the current queue
    const queue = await getOperationQueue();
    if (queue.length === 0) {
      return 0;
    }
    
    // Notify listeners that processing has started
    notifyQueueEventListeners('queueProcessingStarted', {
      id: 'queue-processing',
      type: OperationType.CUSTOM,
      data: { queueSize: queue.length },
      status: OperationStatus.IN_PROGRESS,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      maxRetries: 0
    });
    
    // Find operations that are ready to process
    const now = Date.now();
    const operationsToProcess = queue.filter(op => 
      (op.status === OperationStatus.PENDING || 
       (op.status === OperationStatus.RETRY && (!op.nextRetryTime || op.nextRetryTime <= now)))
    );
    
    // Process each operation
    let processedCount = 0;
    for (const operation of operationsToProcess) {
      // Skip if we've gone offline during processing
      if (!force && !isNetworkAvailable()) {
        break;
      }
      
      const success = await processOperation(operation);
      if (success) {
        processedCount++;
      }
    }
    
    // Schedule next processing for retry operations
    const remainingRetries = (await getOperationQueue()).filter(op => op.status === OperationStatus.RETRY);
    if (remainingRetries.length > 0) {
      // Find the soonest retry time
      const nextRetryTime = Math.min(...remainingRetries.map(op => op.nextRetryTime || Infinity));
      const delay = Math.max(nextRetryTime - Date.now(), 1000); // At least 1 second
      
      queueProcessorTimeout = setTimeout(() => {
        processOperationQueue();
      }, delay);
    }
    
    // Notify listeners that processing has completed
    notifyQueueEventListeners('queueProcessingCompleted', {
      id: 'queue-processing',
      type: OperationType.CUSTOM,
      data: { processedCount, remainingCount: queue.length - processedCount },
      status: OperationStatus.COMPLETED,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      maxRetries: 0
    });
    
    return processedCount;
  } catch (error) {
    logError(new QueueError('Error processing operation queue', error as Error));
    return 0;
  } finally {
    queueProcessorRunning = false;
  }
}

/**
 * Get the count of pending operations in the queue
 * @returns The number of pending operations
 */
export async function getPendingOperationCount(): Promise<number> {
  const queue = await getOperationQueue();
  return queue.filter(op => op.status === OperationStatus.PENDING || op.status === OperationStatus.RETRY).length;
}

/**
 * Get the count of failed operations in the queue
 * @returns The number of failed operations
 */
export async function getFailedOperationCount(): Promise<number> {
  const queue = await getOperationQueue();
  return queue.filter(op => op.status === OperationStatus.FAILED).length;
}

/**
 * Retry a failed operation
 * @param operationId The ID of the operation to retry
 * @returns The updated operation or null if not found
 */
export async function retryOperation(operationId: string): Promise<QueuedOperation | null> {
  const queue = await getOperationQueue();
  const operation = queue.find(op => op.id === operationId);
  
  if (!operation || operation.status !== OperationStatus.FAILED) {
    return null;
  }
  
  // Reset retry count and status
  const updatedOperation = await updateOperation(operationId, {
    status: OperationStatus.PENDING,
    retryCount: 0,
    error: undefined,
    nextRetryTime: undefined
  });
  
  // Process the queue if we're online
  if (isNetworkAvailable()) {
    processOperationQueue();
  }
  
  return updatedOperation;
}

/**
 * Retry all failed operations
 * @returns The number of operations that were reset for retry
 */
export async function retryAllFailedOperations(): Promise<number> {
  const queue = await getOperationQueue();
  const failedOperations = queue.filter(op => op.status === OperationStatus.FAILED);
  
  for (const operation of failedOperations) {
    await updateOperation(operation.id, {
      status: OperationStatus.PENDING,
      retryCount: 0,
      error: undefined,
      nextRetryTime: undefined
    });
  }
  
  // Process the queue if we're online
  if (isNetworkAvailable() && failedOperations.length > 0) {
    processOperationQueue();
  }
  
  return failedOperations.length;
}

// Initialize network listeners
initNetworkListeners();

// Enhanced versions of existing functions that support offline operation

/**
 * Submit a new product to the Open Beauty Facts database with offline support
 * @param product The product data to submit
 * @param credentials Optional credentials (if not provided, stored credentials will be used)
 * @param options Optional configuration for the operation
 * @returns A promise that resolves when the operation is queued or completed
 */
export async function submitNewProductWithOfflineSupport(
  product: ProductContribution,
  credentials?: OpenFoodFactsCredentials,
  options: { maxRetries?: number; forceQueue?: boolean } = {}
): Promise<{ status: string; statusCode: number; message: string; operationId?: string }> {
  // Validate product data first to fail fast
  const validationErrors = validateProductData(product);
  if (validationErrors) {
    throw new ValidationError('Invalid product data', validationErrors);
  }
  
  // If we're online and not forcing queue, try to submit immediately
  if (isNetworkAvailable() && !options.forceQueue) {
    try {
      return await submitNewProduct(product, credentials);
    } catch (error) {
      // If it's not a network error, rethrow
      if (!(error instanceof NetworkError)) {
        throw error;
      }
      
      // Otherwise, fall through to queue the operation
    }
  }
  
  // Queue the operation for later
  const operation = await enqueueOperation(
    OperationType.SUBMIT_PRODUCT,
    { product, credentials },
    { maxRetries: options.maxRetries }
  );
  
  return {
    status: 'queued',
    statusCode: 202,
    message: 'Product submission queued for processing',
    operationId: operation.id
  };
}

/**
 * Update an existing product with offline support
 * @param update The product update data
 * @param credentials Optional credentials (if not provided, stored credentials will be used)
 * @param options Optional configuration for the operation
 * @returns A promise that resolves when the operation is queued or completed
 */
export async function updateExistingProductWithOfflineSupport(
  update: ProductUpdate,
  credentials?: OpenFoodFactsCredentials,
  options: { maxRetries?: number; forceQueue?: boolean } = {}
): Promise<{ status: string; statusCode: number; message: string; operationId?: string }> {
  // Validate update data first to fail fast
  if (!update.code) {
    throw new ValidationError('Invalid product data', { code: 'Barcode is required' });
  } else if (!/^\d{8,14}$/.test(update.code)) {
    throw new ValidationError('Invalid product data', { code: 'Barcode must be 8-14 digits' });
  }
  
  // Ensure at least one field to update is provided
  const updateFields = Object.keys(update).filter(key => key !== 'code');
  if (updateFields.length === 0) {
    throw new ValidationError('Invalid product data', { 
      general: 'At least one field to update must be provided' 
    });
  }
  
  // If we're online and not forcing queue, try to update immediately
  if (isNetworkAvailable() && !options.forceQueue) {
    try {
      return await updateExistingProduct(update, credentials);
    } catch (error) {
      // If it's not a network error, rethrow
      if (!(error instanceof NetworkError)) {
        throw error;
      }
      
      // Otherwise, fall through to queue the operation
    }
  }
  
  // Queue the operation for later
  const operation = await enqueueOperation(
    OperationType.UPDATE_PRODUCT,
    { update, credentials },
    { maxRetries: options.maxRetries }
  );
  
  return {
    status: 'queued',
    statusCode: 202,
    message: 'Product update queued for processing',
    operationId: operation.id
  };
}

/**
 * Upload a product image with offline support
 * @param barcode The product barcode
 * @param imageFile The image file to upload
 * @param imageType The type of image
 * @param credentials Optional credentials
 * @param options Optional configuration for the operation
 * @returns A promise that resolves when the operation is queued or completed
 */
export async function uploadProductImageWithOfflineSupport(
  barcode: string,
  imageFile: File,
  imageType: 'front' | 'ingredients' | 'nutrition' | 'packaging' | 'other' = 'front',
  credentials?: OpenFoodFactsCredentials,
  options: { maxRetries?: number; forceQueue?: boolean } = {}
): Promise<{ status: string; statusCode: number; message: string; imageUrl?: string; operationId?: string }> {
  // Validate inputs first to fail fast
  if (!barcode || !/^\d{8,14}$/.test(barcode)) {
    throw new ValidationError('Invalid barcode', { code: 'Barcode must be 8-14 digits' });
  }
  
  if (!imageFile) {
    throw new ValidationError('Invalid image', { image: 'Image file is required' });
  }
  
  // Check file type
  const validImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!validImageTypes.includes(imageFile.type)) {
    throw new ValidationError('Invalid image', { 
      image: 'Image must be JPEG, PNG, or GIF' 
    });
  }
  
  // Check file size (max 10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (imageFile.size > MAX_FILE_SIZE) {
    throw new ValidationError('Invalid image', { 
      image: 'Image file is too large (max 10MB)' 
    });
  }
  
  // If we're online and not forcing queue, try to upload immediately
  if (isNetworkAvailable() && !options.forceQueue) {
    try {
      return await uploadProductImage(barcode, imageFile, imageType, credentials);
    } catch (error) {
      // If it's not a network error, rethrow
      if (!(error instanceof NetworkError)) {
        throw error;
      }
      
      // Otherwise, fall through to queue the operation
    }
  }
  
  // Queue the operation for later
  const operation = await enqueueOperation(
    OperationType.UPLOAD_IMAGE,
    { barcode, imageFile, imageType, credentials },
    { maxRetries: options.maxRetries }
  );
  
  return {
    status: 'queued',
    statusCode: 202,
    message: 'Image upload queued for processing',
    operationId: operation.id
  };
}

/**
 * Record a product scan with offline support
 * @param productId The ID of the scanned product
 * @param userId The ID of the user who scanned the product (optional, will use authenticated user if not provided)
 * @param options Optional configuration for the operation
 * @returns A promise that resolves when the operation is queued or completed
 */
export async function recordScanWithOfflineSupport(
  productId: string,
  userId?: string | null,
  options: { maxRetries?: number; forceQueue?: boolean } = {}
): Promise<{ scan?: ScanHistory; operationId?: string }> {
  // If userId is not provided, get the current authenticated user's ID
  if (!userId) {
    userId = await getCurrentUserId();
  }
  
  // If we're online and not forcing queue, try to record immediately
  if (isNetworkAvailable() && !options.forceQueue) {
    try {
      const scan = await recordScan(productId, userId);
      return { scan };
    } catch (error) {
      // If it's not a network error, rethrow
      if (!(error instanceof NetworkError) && !(error instanceof DatabaseError) && !(error instanceof AuthenticationError)) {
        throw error;
      }
      
      // Otherwise, fall through to queue the operation
    }
  }
  
  // If we still don't have a userId and we're queueing, use a temporary ID
  // This will be replaced with the actual user ID when the operation is processed
  const userIdForQueue = userId || 'pending-auth';
  
  // Queue the operation for later
  const operation = await enqueueOperation(
    OperationType.RECORD_SCAN,
    { productId, userId: userIdForQueue, scannedAt: new Date().toISOString() },
    { maxRetries: options.maxRetries }
  );
  
  return { operationId: operation.id };
}

/**
 * Sync local data with server data
 * This function synchronizes local data with the server when coming back online
 * @param options Optional configuration for the sync operation
 * @returns A summary of the sync operation
 */
export async function syncLocalData(options: { 
  forceFullSync?: boolean;
  syncCategories?: boolean;
  syncBrands?: boolean;
  syncPopularProducts?: boolean;
  syncUserData?: boolean;
  userId?: string;
} = {}): Promise<{
  success: boolean;
  categoriesUpdated: boolean;
  brandsUpdated: boolean;
  popularProductsUpdated: boolean;
  userDataUpdated: boolean;
  queueProcessed: number;
  errors: string[];
}> {
  const result = {
    success: true,
    categoriesUpdated: false,
    brandsUpdated: false,
    popularProductsUpdated: false,
    userDataUpdated: false,
    queueProcessed: 0,
    errors: [] as string[]
  };

  try {
    // Check network connectivity
    if (!isNetworkAvailable()) {
      throw new NetworkError('No internet connection available');
    }

    // Process operation queue first
    try {
      result.queueProcessed = await processOperationQueue(true);
    } catch (error) {
      result.errors.push(`Queue processing error: ${(error as Error).message}`);
      result.success = false;
    }

    // Sync categories if requested or not recently synced
    if (options.syncCategories || options.forceFullSync) {
      try {
        await fetchCategories();
        result.categoriesUpdated = true;
      } catch (error) {
        result.errors.push(`Categories sync error: ${(error as Error).message}`);
        result.success = false;
      }
    }

    // Sync brands if requested or not recently synced
    if (options.syncBrands || options.forceFullSync) {
      try {
        await fetchBrands();
        result.brandsUpdated = true;
      } catch (error) {
        result.errors.push(`Brands sync error: ${(error as Error).message}`);
        result.success = false;
      }
    }

    // Sync popular products if requested or not recently synced
    if (options.syncPopularProducts || options.forceFullSync) {
      try {
        await fetchPopularProducts();
        result.popularProductsUpdated = true;
      } catch (error) {
        result.errors.push(`Popular products sync error: ${(error as Error).message}`);
        result.success = false;
      }
    }

    // Sync user data if requested and userId is provided
    if ((options.syncUserData || options.forceFullSync) && options.userId) {
      try {
        await getUserScanHistory(options.userId);
        result.userDataUpdated = true;
      } catch (error) {
        result.errors.push(`User data sync error: ${(error as Error).message}`);
        result.success = false;
      }
    }

    return result;
  } catch (error) {
    // Handle any unexpected errors
    const errorMessage = (error as Error).message;
    result.errors.push(`Sync error: ${errorMessage}`);
    result.success = false;
    
    logError(error as Error, { context: 'syncLocalData', options });
    
    return result;
  }
}

/**
 * Check if data needs to be synced based on last sync time
 * @param cacheKey The cache key to check
 * @param maxAge The maximum age of the cache in milliseconds
 * @returns Whether the data needs to be synced
 */
export async function needsSync(cacheKey: string, maxAge: number): Promise<boolean> {
  try {
    const cachedData = await Storage.getItem(cacheKey);
    
    if (!cachedData) return true;
    
    const { timestamp } = JSON.parse(cachedData);
    
    // Check if cache is expired
    return Date.now() - timestamp > maxAge;
  } catch (error) {
    // If there's an error reading the cache, assume we need to sync
    return true;
  }
}

// ... rest of the file ... 

// Add debugging utility at the beginning of the file
/**
 * Debug utility for product service
 */
export const ProductDebug = {
  enabled: true,
  timers: {} as Record<string, number>,
  
  log: function(message: string, data?: any) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString().split('T')[1];
    console.log(`[ProductDebug ${timestamp}] ${message}`);
    if (data !== undefined) {
      console.log('→ Data:', data);
    }
  },
  
  error: function(message: string, error: any) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString().split('T')[1];
    console.error(`[ProductDebug ${timestamp}] ERROR: ${message}`, error);
  },
  
  startTimer: function(label: string) {
    this.timers[label] = performance.now();
    this.log(`Timer started: ${label}`);
  },
  
  endTimer: function(label: string) {
    if (!this.timers[label]) {
      this.log(`Timer not found: ${label}`);
      return;
    }
    
    const duration = performance.now() - this.timers[label];
    this.log(`Timer ${label} completed: ${duration.toFixed(2)}ms`);
    delete this.timers[label];
    return duration;
  },
  
  enable: function() {
    this.enabled = true;
    this.log('Debugging enabled');
  },
  
  disable: function() {
    this.log('Debugging disabled');
    this.enabled = false;
  },
  
  /**
   * Test direct API access to Open Beauty Facts
   * @param testBarcode Barcode to test (default: "3057742022697" - L'Oreal product)
   */
  testDirectApiAccess: async function(testBarcode: string = "3057742022697") {
    this.log(`Testing direct API access with barcode: ${testBarcode}`);
    this.startTimer('directApiTest');
    
    try {
      const apiUrl = `https://world.openbeautyfacts.org/api/v0/product/${testBarcode}.json`;
      this.log(`Fetching from URL: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      const responseStatus = `${response.status} ${response.statusText}`;
      this.log(`API Response status: ${responseStatus}`);
      
      const data = await response.json();
      this.log('API Response data:', data);
      
      // Check if the response has the expected structure
      if (data.status === 1 && data.product) {
        this.log('✅ API response has valid structure');
        
        // Check for essential fields
        const essentialFields = ['product_name', 'brands', 'categories_tags'];
        const missingFields = essentialFields.filter(field => !data.product[field]);
        
        if (missingFields.length > 0) {
          this.log(`⚠️ API response is missing some fields: ${missingFields.join(', ')}`);
        } else {
          this.log('✅ API response contains all essential fields');
        }
      } else {
        this.log('❌ API response does not have valid structure', data);
      }
      
      this.endTimer('directApiTest');
      return data;
    } catch (error) {
      this.error('Error testing direct API access', error);
      this.endTimer('directApiTest');
      throw error;
    }
  }
};

// Make the debug utility available globally for console access
if (typeof window !== 'undefined') {
  (window as any).ProductDebug = ProductDebug;
}

/**
 * Initialize product debugging tools and make them available in the browser console
 * Call this function in your app's initialization code
 */
export function initProductDebugging(): void {
  if (typeof window !== 'undefined') {
    // Make debugging utilities available globally
    (window as any).ProductDebug = ProductDebug;
    (window as any).testProductAPI = ProductDebug.testDirectApiAccess;
    
    // Add a convenience function to test the entire product lookup process
    (window as any).testProductLookup = async (barcode: string = "3057742022697") => {
      console.log(`🔍 Testing product lookup for barcode: ${barcode}`);
      try {
        const result = await processBarcodeScan(barcode);
        console.log(`✅ Product lookup successful:`, result);
        return result;
      } catch (error) {
        console.error(`❌ Product lookup failed:`, error);
        throw error;
      }
    };
    
    console.log(`
    =====================================================
    🔧 Product debugging tools initialized and available:
    =====================================================
    
    • ProductDebug - Main debugging utility
      - ProductDebug.enable() - Enable debugging
      - ProductDebug.disable() - Disable debugging
    
    • testProductAPI("barcode") - Test direct API access
      - Example: testProductAPI("3057742022697")
    
    • testProductLookup("barcode") - Test the entire product lookup process
      - Example: testProductLookup("3057742022697")
    `);
  }
}