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

/**
 * Interface for Open Food Facts API v3 response
 */
export interface OpenFoodFactsProduct {
  code: string;
  status: string;  // Changed from number to string
  product: {
    _id: string;  // Changed from code
    product_name: string;
    brands: string;
    image_url?: string;
    image_front_url?: string;
    image_ingredients_url?: string;
    image_nutrition_url?: string;
    ingredients_text?: string;
    categories_tags?: string[];
    labels_tags?: string[];
    nutriscore_grade?: string;
    nova_group?: number;
    ecoscore_grade?: string;
    nutriments?: {
      energy_kcal_100g?: number;
      fat_100g?: number;
      saturated_fat_100g?: number;
      carbohydrates_100g?: number;
      sugars_100g?: number;
      fiber_100g?: number;
      proteins_100g?: number;
      salt_100g?: number;
    };
    allergens_tags?: string[];
    ingredients_tags?: string[];
  };
  result?: {
    id: string;
    name: string;
  };
}

/**
 * Interface for category data from Open Food Facts API
 */
export interface Category {
  id: string;
  name: string;
  products: number;
  url: string;
}

/**
 * Interface for brand data from Open Food Facts API
 */
export interface Brand {
  id: string;
  name: string;
  products: number;
  url: string;
}

/**
 * Interface for ingredient data from Open Food Facts API
 */
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
  products: OpenFoodFactsProduct[];
  skip: number;
}

/**
 * Interface for a product in our database
 */
export interface Product {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  safety_score: number; // We'll repurpose this for food health score
  image_url?: string;
  // Food-specific fields (optional for backward compatibility)
  nutriscoreGrade?: string | null;
  novaGroup?: number | null;
  ecoscore?: string | null;
  nutritionFacts?: {
    calories: number | null;
    fat: number | null;
    saturatedFat: number | null;
    carbs: number | null;
    sugars: number | null;
    fiber: number | null;
    proteins: number | null;
    salt: number | null;
  } | null;
  allergens?: string[] | null;
  ingredients?: string[] | null;
  labels?: string[] | null;
  categories?: string[] | null;
  tags?: string[];
  created_at?: string | null;
}

// Type for scan history
export interface ScanHistory {
  id: string;
  product_id: string;
  user_id: string;
  scanned_at: string | null;
  // Database fields
  source?: 'cache' | 'database' | 'api';  // Stored in DB as text
  synced?: boolean;                       // Stored in DB with default FALSE
  // Application-only fields
  product?: Product;                      // Joined from the products table, not stored in scans table
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

// Constants for API configuration
const API_BASE_URL = "https://world.openfoodfacts.org/api/v3/";
const APP_USER_AGENT = 'Scani-App/1.0 (https://yourappwebsite.com; contact@yourappwebsite.com)';

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
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    
    ProductDebug.log(`Fetching from URL: ${url.toString()}`);
    const fetchStartTime = performance.now();
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': APP_USER_AGENT,
        'Accept': 'application/json'
      }
    });
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
export async function fetchProductFromAPI(barcode: string): Promise<OpenFoodFactsProduct | null> {
  ProductDebug.log(`Fetching product from API with barcode: ${barcode}`);
  ProductDebug.startTimer(`fetchProductFromAPI-${barcode}`);
  
  try {
    const apiUrl = `product/${barcode}.json`;
    ProductDebug.log(`Using API endpoint: ${apiUrl}`);
    
    // Check network availability before making the request
    if (!isNetworkAvailable()) {
      ProductDebug.log(`❌ Network unavailable, cannot fetch from API`);
      throw new NetworkError('Network unavailable');
    }
    
    const data = await makeApiRequest<OpenFoodFactsProduct>(apiUrl);
    
    // Log the raw API response for debugging
    ProductDebug.log(`Raw API response for barcode ${barcode}:`, data);
    
    // Check if the product was found - UPDATED FOR V3 API
    if (data.status !== 'success' || data.result?.id !== 'product_found') {
      ProductDebug.log(`❌ Product not found in API response (status=${data.status}, result.id=${data.result?.id})`, data);
      throw new ProductNotFoundError(barcode);
    }
    
    // Verify the response structure
    if (!data.product) {
      ProductDebug.log(`❌ Invalid API response - missing product object`, data);
      throw new ProductServiceError(`Invalid API response for barcode ${barcode} - missing product object`);
    }
    
    // Check for essential fields
    const essentialFields = ['product_name', 'brands', 'categories_tags'];
    const missingFields = essentialFields.filter(field => !data.product[field]);
    
    if (missingFields.length > 0) {
      ProductDebug.log(`⚠️ API response missing essential fields: ${missingFields.join(', ')}`, data.product);
      // Log warning but don't fail - we'll use whatever data we have
      console.warn('API response missing essential fields', { barcode, missingFields });
    }
    
    ProductDebug.log(`✅ Product successfully fetched from API`, {
      barcode,
      name: data.product.product_name,
      brand: data.product.brands,
      hasImage: !!data.product.image_url || !!data.product.image_front_url,
      categories: data.product.categories_tags?.length || 0,
      nutriscore: data.product.nutriscore_grade || 'unknown',
      novaGroup: data.product.nova_group || 'unknown'
    });
    
    ProductDebug.endTimer(`fetchProductFromAPI-${barcode}`);
    return data;
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      ProductDebug.log(`Product not found in API: ${barcode}`);
      logError(error, { barcode, context: 'fetchProductFromAPI' });
      ProductDebug.endTimer(`fetchProductFromAPI-${barcode}`);
      return null;
    }
    
    if (error instanceof NetworkError) {
      ProductDebug.log(`Network error when fetching from API: ${barcode}`);
      logError(error, { barcode, context: 'fetchProductFromAPI' });
      ProductDebug.endTimer(`fetchProductFromAPI-${barcode}`);
      throw error;
    }
    
    ProductDebug.error(`Error fetching product from API: ${barcode}`, error);
    logError(error instanceof Error ? error : new Error(String(error)), { barcode, context: 'fetchProductFromAPI' });
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
  ProductDebug.log(`Recording scan for product: ${productId}, user: ${userId || 'current user'}, source: ${source}`);
  ProductDebug.startTimer('recordScan');
  
  try {
    // Get current user ID if not provided
    if (!userId) {
      userId = await getCurrentUserId();
      
      if (!userId) {
        ProductDebug.error(`User not authenticated when recording scan`, { userId });
        throw new AuthenticationError('User not authenticated');
      }
    }
    
    // Create scan record with all fields that exist in the database
    const scanData = {
      product_id: productId,
      user_id: userId,
      scanned_at: new Date().toISOString(),
      source, // Now included in the database schema
      synced: false // Default value, will be updated when synced
    };
    
    ProductDebug.log(`Inserting scan record:`, scanData);
    
    // Insert into database
    const { data, error } = await supabase
      .from('scans')
      .insert(scanData)
      .select('*')
      .single();
    
    if (error) {
      ProductDebug.error(`Error recording scan: ${error.message}`, { error });
      throw new DatabaseError(`Error recording scan: ${error.message}`, error);
    }
    
    if (!data) {
      ProductDebug.error(`No data returned after recording scan`, { productId, userId });
      throw new DatabaseError('No data returned after recording scan');
    }
    
    const scanResult: ScanHistory = data;
    
    ProductDebug.log(`Scan recorded successfully with ID: ${scanResult.id}`);
    ProductDebug.endTimer('recordScan');
    
    return scanResult;
  } catch (error) {
    ProductDebug.endTimer('recordScan');
    ProductDebug.error(`Error recording scan:`, { error });
    console.error('Error recording scan:', error);
    throw error;
  }
}

/**
 * Get scan history for a user
 * @param userId The ID of the user
 * @param limit The maximum number of scans to return
 * @returns Array of scan records with product data
 */
export async function getUserScanHistory(userId: string, limit = 10): Promise<ScanHistory[]> {
  ProductDebug.log(`Getting scan history for user: ${userId}, limit: ${limit}`);
  ProductDebug.startTimer('getUserScanHistory');
  
  try {
    // First check if the user exists
    const { data: userExists, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (userError) {
      ProductDebug.error(`Error checking if user exists: ${userError.message}`, userError);
      throw new DatabaseError(`Error checking if user exists: ${userError.message}`, userError);
    }
    
    if (!userExists) {
      ProductDebug.error(`User not found: ${userId}`, { userId });
      throw new DatabaseError(`User not found: ${userId}`);
    }
    
    // Get scan history with product data
    // Use * to select all columns, which will adapt to schema changes
    const { data, error } = await supabase
      .from('scans')
      .select(`
        *,
        products(*)
      `)
      .eq('user_id', userId)
      .order('scanned_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      ProductDebug.error(`Error getting user scan history:`, { error });
      throw new DatabaseError(`Error getting user scan history: ${error.message}`, error);
    }
    
    if (!data || data.length === 0) {
      ProductDebug.log(`No scan history found for user: ${userId}`);
      return [];
    }
    
    // Transform the data to match the ScanHistory interface
    const scanHistory: ScanHistory[] = data.map(scan => {
      // Extract the product from the nested products object
      const product = scan.products as unknown as Product;
      
      // Create a base scan object with required fields
      const scanRecord: ScanHistory = {
        id: scan.id,
        product_id: scan.product_id,
        user_id: scan.user_id,
        scanned_at: scan.scanned_at,
        product: product
      };
      
      // Add source and synced if they exist in the database record
      if ('source' in scan && typeof scan.source === 'string') {
        scanRecord.source = scan.source as 'cache' | 'database' | 'api';
      }
      
      if ('synced' in scan && typeof scan.synced === 'boolean') {
        scanRecord.synced = scan.synced;
      }
      
      return scanRecord;
    });
    
    ProductDebug.log(`Found ${scanHistory.length} scans for user: ${userId}`);
    
    // Update cache with products from scan history
    if (scanHistory.length > 0) {
      for (const scan of scanHistory) {
        if (scan.product) {
          await saveToCache(scan.product);
        }
      }
    }
    
    ProductDebug.endTimer('getUserScanHistory');
    return scanHistory;
  } catch (error) {
    ProductDebug.endTimer('getUserScanHistory');
    ProductDebug.error(`Error getting user scan history:`, { error });
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
  ProductDebug.log(`Processing barcode scan: ${barcode}`);
  ProductDebug.startTimer('processBarcodeScan');
  
  let product: Product | null = null;
  let productSource = '';
  const isOnline = isNetworkAvailable();
  
  // Direct API first approach
  if (isOnline) {
    ProductDebug.log(`Step 1: Checking API for barcode: ${barcode} (direct API first approach)`);
    ProductDebug.startTimer('apiCheck');
    try {
      const apiProduct = await fetchProductFromAPI(barcode);
      
      if (apiProduct) {
        productSource = 'api';
        ProductDebug.log(`✅ Product found in API`, apiProduct);
        console.log('Product found in API', { barcode });
        
        // Convert API product to our Product format using the mapping function
        const productData = mapApiResponseToProduct(apiProduct, barcode);
        
        // Return the product immediately for display
        product = {
          ...productData,
          id: generateUUID(), // Generate a temporary ID for immediate display
          created_at: new Date().toISOString()
        };
        
        // Save to database in the background
        ProductDebug.log(`Saving product to database in background`);
        saveProductToDatabase(productData)
          .then(savedProduct => {
            ProductDebug.log(`Product saved to database with ID: ${savedProduct.id}`);
            // Update cache with the saved product that has a proper database ID
            saveToCache(savedProduct).catch(cacheError => {
              ProductDebug.error(`Error saving to cache`, cacheError);
            });
          })
          .catch(saveError => {
            ProductDebug.error(`Error saving product to database`, saveError);
            logError(saveError instanceof Error ? saveError : new Error(String(saveError)), { context: 'saveProductToDatabase' });
          });
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
        // Don't throw here, continue to fallbacks
        logError(error instanceof Error ? error : new Error(String(error)), { context: 'fetchProductFromAPI' });
      }
    }
  } else {
    ProductDebug.log(`Skipping API check - offline`);
  }
  
  // If product not found in API, check cache
  if (!product) {
    ProductDebug.log(`Step 2: Checking cache for barcode: ${barcode}`);
    ProductDebug.startTimer('cacheCheck');
    try {
      const cachedProduct = await getFromCache(barcode);
      if (cachedProduct) {
        product = cachedProduct;
        productSource = 'cache';
        ProductDebug.log(`✅ Product found in cache`, cachedProduct);
      } else {
        ProductDebug.log(`❌ Product not found in cache`);
      }
      ProductDebug.endTimer('cacheCheck');
    } catch (error) {
      ProductDebug.endTimer('cacheCheck');
      ProductDebug.error(`Error checking cache`, error);
      // Continue to next source
    }
  } else {
    ProductDebug.log(`Skipping cache check - product already found in API`);
  }
  
  // If product not found in cache, check database
  if (!product && isOnline) {
    ProductDebug.log(`Step 3: Checking database for barcode: ${barcode}`);
    ProductDebug.startTimer('databaseCheck');
    try {
      const dbProduct = await getProductByBarcode(barcode);
      if (dbProduct) {
        product = dbProduct;
        productSource = 'database';
        ProductDebug.log(`✅ Product found in database`, dbProduct);
      } else {
        ProductDebug.log(`❌ Product not found in database`);
      }
      ProductDebug.endTimer('databaseCheck');
    } catch (error) {
      ProductDebug.endTimer('databaseCheck');
      // Handle database errors
      if (error instanceof DatabaseError) {
        ProductDebug.error(`Database error when fetching product`, error);
      } else {
        ProductDebug.error(`Unexpected error when fetching from database`, error);
        // Don't throw here, continue to fallbacks
        logError(error instanceof Error ? error : new Error(String(error)), { context: 'getProductByBarcode' });
      }
    }
  } else if (!product) {
    ProductDebug.log(`Skipping database check - ${isOnline ? 'product already found' : 'offline'}`);
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

// Rename the old function to maintain backward compatibility
export function calculateSafetyScore(product: OpenFoodFactsProduct): number {
  return calculateHealthScore(product);
}

/**
 * Calculate a health score based on Nutri-Score and NOVA group
 * @param product The Open Food Facts product data
 * @returns A health score between 0-100
 */
export function calculateHealthScore(product: OpenFoodFactsProduct): number {
  // Base score starts at 50 (neutral)
  let score = 50;
  
  // Add points based on Nutri-Score (A=excellent, E=poor)
  if (product.product.nutriscore_grade) {
    switch (product.product.nutriscore_grade.toUpperCase()) {
      case 'A': score += 30; break;
      case 'B': score += 20; break;
      case 'C': score += 10; break;
      case 'D': score -= 10; break;
      case 'E': score -= 20; break;
    }
  }
  
  // Subtract points based on NOVA group (1=unprocessed, 4=ultra-processed)
  if (product.product.nova_group) {
    switch (product.product.nova_group) {
      case 1: score += 20; break;
      case 2: score += 10; break;
      case 3: score -= 10; break;
      case 4: score -= 20; break;
    }
  }
  
  // Add points for organic labels
  const labels = product.product.labels_tags || [];
  if (labels.some(label => label.includes('organic') || label.includes('bio'))) {
    score += 10;
  }
  
  // Ensure score stays within 0-100 range
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
  image_url?: string;
  ingredients_text?: string;
  nutriments?: {
    [key: string]: number | string;
  };
  nutriscoreGrade?: string;
  novaGroup?: number;
  ecoscore?: string;
  safety_score?: number;
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
 * Store Open Food Facts credentials securely
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
 * Get stored Open Food Facts credentials
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
 * Clear stored Open Food Facts credentials
 */
export async function clearCredentials(): Promise<void> {
  try {
    await Storage.removeItem(CACHE_KEY_CREDENTIALS);
  } catch (error) {
    console.warn('Failed to clear credentials:', error);
  }
}

/**
 * Submit a new product to the Open Food Facts database
 * @param product The product data to submit
 * @param credentials Optional credentials for authentication
 * @returns Status of the submission
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
    const response = await fetch('https://world.openfoodfacts.org/cgi/product_jqm2.pl', {
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
 * Update an existing product in the Open Food Facts database
 * @param update The product data to update
 * @param credentials Optional credentials for authentication
 * @returns Status of the update
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
    const response = await fetch('https://world.openfoodfacts.org/cgi/product_jqm2.pl', {
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
 * Upload a product image to the Open Food Facts database
 * @param barcode The product barcode
 * @param imageFile The image file to upload
 * @param imageType The type of image (front, ingredients, etc.)
 * @param credentials Optional credentials for authentication
 * @returns Status of the upload
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
    const response = await fetch('https://world.openfoodfacts.org/cgi/product_image_upload.pl', {
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
 * Check if the user has valid credentials for Open Food Facts
 * @param credentials The credentials to check
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
    const response = await fetch('https://world.openfoodfacts.org/cgi/session.pl', {
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
interface QueuedOperationData {
  // For SUBMIT_PRODUCT
  product?: ProductContribution;
  // For UPDATE_PRODUCT
  update?: ProductUpdate;
  // For UPLOAD_IMAGE
  barcode?: string;
  imageFile?: File;
  imageType?: ImageType;
  // For RECORD_SCAN
  productId?: string;
  userId?: string;
  source?: ScanSource;
  timestamp?: number;
  // For CUSTOM
  process?: () => Promise<void>;
  // Common fields
  credentials?: OpenFoodFactsCredentials;
  // Queue status fields
  isOnline?: boolean;
  queueSize?: number;
  processedCount?: number;
  remainingCount?: number;
}

interface QueuedOperation {
  id: string;
  type: OperationType;
  data: QueuedOperationData;
  status: OperationStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryTime?: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

type ImageType = 'ingredients' | 'packaging' | 'front' | 'nutrition' | 'other';
type ScanSource = 'cache' | 'database' | 'api';

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
  
  // If we're in a browser environment, use navigator.onLine
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    // Update our cached value
    isOnline = navigator.onLine;
    ProductDebug.log(`Network availability check: ${isOnline ? 'Online' : 'Offline'}`);
    return isOnline;
  }
  
  // Fallback for non-browser environments
  ProductDebug.log(`Network availability check: Using cached value ${isOnline ? 'Online' : 'Offline'}`);
  return isOnline;
}

/**
 * Actively test network connectivity by making a small request
 * @returns Promise resolving to whether the network is available
 */
export async function testNetworkConnectivity(): Promise<boolean> {
  ProductDebug.log(`Testing network connectivity...`);
  
  try {
    // Try to fetch a small resource to test connectivity
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch('https://world.openfoodfacts.org/api/v2/ping', {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    
    const isConnected = response.ok;
    ProductDebug.log(`Network connectivity test result: ${isConnected ? 'Connected' : 'Disconnected'}`);
    
    // Update our cached value
    isOnline = isConnected;
    
    return isConnected;
  } catch (error) {
    ProductDebug.error(`Network connectivity test failed`, error);
    
    // Update our cached value
    isOnline = false;
    
    return false;
  }
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
  ProductDebug.log(`Processing operation: ${operation.id} (${operation.type})`);
  
  try {
    // Mark operation as in progress
    await updateOperation(operation.id, {
      status: OperationStatus.IN_PROGRESS,
      updatedAt: Date.now()
    });
    
    // Process based on operation type
    switch (operation.type) {
      case OperationType.SUBMIT_PRODUCT: {
        const { product, credentials } = operation.data;
        const result = await submitNewProduct(product, credentials);
        
        if (result.statusCode >= 200 && result.statusCode < 300) {
          return true;
        } else {
          throw new ProductServiceError(`Failed to submit product: ${result.message}`);
        }
      }
      
      case OperationType.UPDATE_PRODUCT: {
        const { update, credentials } = operation.data;
        const result = await updateExistingProduct(update, credentials);
        
        if (result.statusCode >= 200 && result.statusCode < 300) {
          return true;
        } else {
          throw new ProductServiceError(`Failed to update product: ${result.message}`);
        }
      }
      
      case OperationType.UPLOAD_IMAGE: {
        const { barcode, imageFile, imageType, credentials } = operation.data;
        const result = await uploadProductImage(barcode, imageFile, imageType, credentials);
        
        if (result.statusCode >= 200 && result.statusCode < 300) {
          return true;
        } else {
          throw new ProductServiceError(`Failed to upload image: ${result.message}`);
        }
      }
      
      case OperationType.RECORD_SCAN: {
        const { productId, userId, source, timestamp } = operation.data;
        
        // Get current user if userId is not provided or is 'pending-auth'
        let actualUserId = userId;
        if (!actualUserId || actualUserId === 'pending-auth') {
          actualUserId = await getCurrentUserId();
          if (!actualUserId) {
            throw new AuthenticationError('User not authenticated');
          }
        }
        
        // Record the scan with the actual user ID and source
        await recordScan(productId, actualUserId, source || 'api');
        return true;
      }
      
      case OperationType.CUSTOM: {
        // Custom operations should provide their own processing logic
        if (typeof operation.data.process === 'function') {
          await operation.data.process();
          return true;
        } else {
          throw new QueueError('Custom operation does not provide a process function');
        }
      }
      
      default:
        throw new QueueError(`Unknown operation type: ${operation.type}`);
    }
  } catch (error) {
    // Handle specific error types
    if (error instanceof NetworkError) {
      ProductDebug.error(`Network error when processing operation ${operation.id}`, error);
      return false; // Network errors should be retried
    }
    
    if (error instanceof AuthenticationError) {
      ProductDebug.error(`Authentication error when processing operation ${operation.id}`, error);
      // Authentication errors should not be retried unless we have a way to re-authenticate
      return operation.retryCount < 1; // Only retry once for auth errors
    }
    
    // Log the error and return false to indicate failure
    ProductDebug.error(`Error processing operation ${operation.id}`, error);
    logError(error instanceof Error ? error : new Error(String(error)), {
      operationType: operation.type,
      retryCount: operation.retryCount,
      maxRetries: operation.maxRetries
    });
    
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
 * Submit a new product to the Open Food Facts database with offline support
 * @param product The product data to submit
 * @param credentials Optional credentials for authentication
 * @param options Optional configuration for the operation
 * @returns Status of the submission
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
 * @param credentials Optional credentials for authentication
 * @param options Optional configuration for the operation
 * @returns Status of the update
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
  options: { maxRetries?: number; forceQueue?: boolean; source?: 'cache' | 'database' | 'api' } = {}
): Promise<{ scan?: ScanHistory; operationId?: string }> {
  const isOnline = isNetworkAvailable();
  const source = options.source || 'api';
  
  ProductDebug.log(`Recording scan with offline support for product: ${productId}, user: ${userId || 'current user'}, source: ${source}`);
  
  // If we're online and not forcing queue, try to record directly
  if (isOnline && !options.forceQueue) {
    try {
      const scan = await recordScan(productId, userId, source);
      return { scan };
    } catch (error) {
      // If direct recording fails, fall back to queue
      ProductDebug.error(`Direct scan recording failed, falling back to queue`, { error, productId });
      console.warn('Direct scan recording failed, falling back to queue', { productId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  
  // Queue the operation for later processing
  try {
    const operation = await enqueueOperation(
      OperationType.RECORD_SCAN,
      {
        productId,
        userId,
        source,
        timestamp: Date.now()
      },
      { maxRetries: options.maxRetries }
    );
    
    ProductDebug.log(`Scan queued for later processing with operation ID: ${operation.id}`);
    return { operationId: operation.id };
  } catch (error) {
    ProductDebug.error(`Failed to queue scan recording`, { error, productId });
    throw new QueueError(`Failed to queue scan recording: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
  }
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
  syncUnsyncedScans?: boolean;
  userId?: string;
} = {}): Promise<{
  success: boolean;
  categoriesUpdated: boolean;
  brandsUpdated: boolean;
  popularProductsUpdated: boolean;
  userDataUpdated: boolean;
  unsyncedScansProcessed: number;
  queueProcessed: number;
  errors: string[];
}> {
  const result = {
    success: true,
    categoriesUpdated: false,
    brandsUpdated: false,
    popularProductsUpdated: false,
    userDataUpdated: false,
    unsyncedScansProcessed: 0,
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

    // Add this code to the syncLocalData function, before the return statement
    // Sync unsynced scans if requested
    if ((options.syncUnsyncedScans || options.forceFullSync) && options.userId) {
      try {
        ProductDebug.log('Syncing unsynced scans...');
        const syncedCount = await syncUnsyncedScans(options.userId);
        result.unsyncedScansProcessed = syncedCount;
        ProductDebug.log(`Synced ${syncedCount} scans`);
      } catch (error) {
        const errorMessage = `Error syncing unsynced scans: ${error instanceof Error ? error.message : String(error)}`;
        ProductDebug.error(errorMessage, { error });
        result.errors.push(errorMessage);
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
   * Test direct API access to Open Food Facts
   * @param testBarcode Barcode to test (default: "3017620422003" - Nutella)
   */
  testDirectApiAccess: async function(testBarcode: string = "3017620422003") {
    this.log(`Testing direct API access with barcode: ${testBarcode}`);
    this.startTimer('directApiTest');
    
    try {
      const apiUrl = `${API_BASE_URL}product/${testBarcode}.json`;
      this.log(`Fetching from URL: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      const responseStatus = `${response.status} ${response.statusText}`;
      this.log(`API Response status: ${responseStatus}`);
      
      const data = await response.json();
      this.log('API Response data:', data);
      
      // Check if the response has the expected structure - UPDATED FOR V3 API
      if (data.status === 'success' && data.result?.id === 'product_found' && data.product) {
        this.log('✅ API response has valid structure');
        
        // Check for essential fields
        const essentialFields = ['product_name', 'brands', 'categories_tags'];
        const missingFields = essentialFields.filter(field => !data.product[field]);
        
        if (missingFields.length > 0) {
          this.log(`⚠️ API response is missing some fields: ${missingFields.join(', ')}`);
        } else {
          this.log('✅ API response contains all essential fields');
        }
        
        // Check for food-specific fields
        const foodFields = ['nutriscore_grade', 'nova_group', 'nutriments'];
        const missingFoodFields = foodFields.filter(field => !data.product[field]);
        
        if (missingFoodFields.length > 0) {
          this.log(`⚠️ API response is missing some food-specific fields: ${missingFoodFields.join(', ')}`);
        } else {
          this.log('✅ API response contains all food-specific fields');
        }
        
        // Log the extracted product details
        this.log('Extracted product details:', {
          name: data.product.product_name,
          brand: data.product.brands,
          imageUrl: data.product.image_front_url || data.product.image_url,
          nutriscore: data.product.nutriscore_grade,
          novaGroup: data.product.nova_group,
          categories: data.product.categories_tags?.length
        });
      } else {
        this.log('❌ API response does not have valid structure', {
          status: data.status,
          resultId: data.result?.id,
          hasProductObject: !!data.product
        });
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
    
    // Bind the function to the ProductDebug object to fix 'this' context
    (window as any).testProductAPI = function(barcode) {
      return ProductDebug.testDirectApiAccess.call(ProductDebug, barcode);
    };
    
    // Add a convenience function to test the entire product lookup process
    (window as any).testProductLookup = async (barcode: string = "3017620422003") => {
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
      - Example: testProductAPI("3017620422003")
    
    • testProductLookup("barcode") - Test the entire product lookup process
      - Example: testProductLookup("3017620422003")
    `);
  }
}

/**
 * Map an Open Food Facts API v3 response to our Product interface
 * @param apiProduct The API response product
 * @param barcode The product barcode
 * @returns A Product object with data from the API
 */
function mapApiResponseToProduct(apiProduct: OpenFoodFactsProduct, barcode: string): Omit<Product, 'id' | 'created_at'> {
  // Log the mapping process
  ProductDebug.log(`Mapping API response to product model for barcode: ${barcode}`);
  
  // Extract nutrition facts from the API response
  const nutriments = apiProduct.product.nutriments || {};
  const nutritionFacts = {
    calories: nutriments.energy_kcal_100g || null,
    fat: nutriments.fat_100g || null,
    saturatedFat: nutriments.saturated_fat_100g || null,
    carbs: nutriments.carbohydrates_100g || null,
    sugars: nutriments.sugars_100g || null,
    fiber: nutriments.fiber_100g || null,
    proteins: nutriments.proteins_100g || null,
    salt: nutriments.salt_100g || null
  };
  
  // Extract product name and brand, ensuring we have valid values
  const productName = apiProduct.product.product_name || 'Unknown Product';
  const brandName = apiProduct.product.brands || 'Unknown Brand';
  
  // Get the best available image URL
  const imageUrl = apiProduct.product.image_front_url || apiProduct.product.image_url || undefined;
  
  // Calculate safety score
  const safetyScore = calculateHealthScore(apiProduct);
  
  // Extract other food-specific data
  const mappedProduct = {
    barcode,
    name: productName,
    brand: brandName,
    safety_score: safetyScore,
    image_url: imageUrl,
    nutriscoreGrade: apiProduct.product.nutriscore_grade || null,
    novaGroup: apiProduct.product.nova_group || null,
    ecoscore: apiProduct.product.ecoscore_grade || null,
    nutritionFacts,
    allergens: apiProduct.product.allergens_tags || null,
    ingredients: apiProduct.product.ingredients_tags || null,
    labels: apiProduct.product.labels_tags || null,
    categories: apiProduct.product.categories_tags || null,
    tags: apiProduct.product.categories_tags || []
  };
  
  // Log the mapped product
  ProductDebug.log(`Successfully mapped API response to product model`, {
    barcode,
    name: mappedProduct.name,
    brand: mappedProduct.brand,
    safetyScore: mappedProduct.safety_score,
    hasImage: !!mappedProduct.image_url
  });
  
  return mappedProduct;
}

/**
 * Generate a UUID v4 for temporary use
 * @returns A UUID v4 string
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Refresh the Supabase schema cache
 * This can help resolve issues where the client has an outdated schema
 * @returns A promise that resolves when the schema has been refreshed
 */
export async function refreshSupabaseSchema(): Promise<void> {
  ProductDebug.log('Refreshing Supabase schema cache');
  
  try {
    // Make a simple query to force a schema refresh
    await supabase.from('products').select('id').limit(1);
    await supabase.from('scans').select('id').limit(1);
    await supabase.from('profiles').select('id').limit(1);
    
    // Clear any local caches that might be affected
    await cleanupCache();
    
    ProductDebug.log('Supabase schema cache refreshed successfully');
  } catch (error) {
    ProductDebug.error('Error refreshing Supabase schema cache', { error });
    console.error('Error refreshing Supabase schema cache:', error);
    throw new DatabaseError('Failed to refresh Supabase schema cache', error instanceof Error ? error : undefined);
  }
}

/**
 * Diagnose scan history issues for a user
 * This function performs various checks to identify potential issues with scan history
 * @param userId The ID of the user to diagnose
 * @returns A diagnostic report
 */
export async function diagnoseScanHistoryIssues(userId: string): Promise<{
  userExists: boolean;
  scanCount: number;
  productCount: number;
  rowLevelSecurityEnabled: boolean;
  databasePermissions: boolean;
  issues: string[];
  recommendations: string[];
}> {
  ProductDebug.log(`Diagnosing scan history issues for user: ${userId}`);
  
  const issues: string[] = [];
  const recommendations: string[] = [];
  let userExists = false;
  let scanCount = 0;
  let productCount = 0;
  let rowLevelSecurityEnabled = true;
  let databasePermissions = true;
  
  try {
    // Check if user exists
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (userError) {
      if (userError.code === 'PGRST116') {
        issues.push(`User with ID ${userId} does not exist in the profiles table`);
        recommendations.push('Create a profile for this user');
        userExists = false;
      } else {
        issues.push(`Error checking user: ${userError.message}`);
        databasePermissions = false;
      }
    } else {
      userExists = true;
    }
    
    // Check scan count
    const { count: scans, error: scanCountError } = await supabase
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (scanCountError) {
      issues.push(`Error counting scans: ${scanCountError.message}`);
      databasePermissions = false;
    } else {
      scanCount = scans || 0;
      if (scanCount === 0) {
        issues.push('No scans found for this user');
        recommendations.push('Check if scans are being properly recorded');
      }
    }
    
    // Check product count
    const { count: products, error: productCountError } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true });
    
    if (productCountError) {
      issues.push(`Error counting products: ${productCountError.message}`);
      databasePermissions = false;
    } else {
      productCount = products || 0;
      if (productCount === 0) {
        issues.push('No products found in the database');
        recommendations.push('Check if products are being properly saved');
      }
    }
    
    // Check RLS policies
    try {
      // Try to access another user's data to check if RLS is working
      const { data: otherUserData, error: rlsError } = await supabase
        .from('scans')
        .select('id')
        .neq('user_id', userId)
        .limit(1);
      
      if (!rlsError && otherUserData && otherUserData.length > 0) {
        // If we can access other users' data, RLS might not be properly configured
        rowLevelSecurityEnabled = false;
        issues.push('Row Level Security may not be properly configured');
        recommendations.push('Review RLS policies for the scans table');
      }
    } catch (error) {
      // Expected error if RLS is working correctly
      rowLevelSecurityEnabled = true;
    }
    
    // Check for schema issues
    try {
      // Try to select a non-existent column to check schema
      const { error: schemaError } = await supabase
        .from('scans')
        .select('non_existent_column')
        .limit(1);
      
      if (schemaError) {
        // This is expected
      }
    } catch (error) {
      issues.push('Schema validation error occurred');
      recommendations.push('Refresh the Supabase schema cache');
    }
    
    // Add general recommendations
    if (issues.length === 0) {
      recommendations.push('No issues detected. If problems persist, check network connectivity and browser console for errors');
    } else {
      recommendations.push('Check browser console for detailed error messages');
      recommendations.push('Verify that the user has the correct permissions');
      recommendations.push('Try refreshing the Supabase schema cache');
    }
    
    return {
      userExists,
      scanCount,
      productCount,
      rowLevelSecurityEnabled,
      databasePermissions,
      issues,
      recommendations
    };
  } catch (error) {
    ProductDebug.error('Error diagnosing scan history issues', { error, userId });
    
    issues.push(`Unexpected error during diagnosis: ${error instanceof Error ? error.message : String(error)}`);
    recommendations.push('Check browser console for detailed error messages');
    
    return {
      userExists: false,
      scanCount: 0,
      productCount: 0,
      rowLevelSecurityEnabled: true,
      databasePermissions: false,
      issues,
      recommendations
    };
  }
}

/**
 * Mark a scan as synced
 * @param scanId The ID of the scan to mark as synced
 * @returns The updated scan record
 */
export async function markScanAsSynced(scanId: string): Promise<ScanHistory> {
  ProductDebug.log(`Marking scan as synced: ${scanId}`);
  
  try {
    const { data, error } = await supabase
      .from('scans')
      .update({ 
        synced: true 
      } as any)
      .eq('id', scanId)
      .select('*')
      .single();
    
    if (error) {
      ProductDebug.error(`Error marking scan as synced: ${error.message}`, { error, scanId });
      throw new DatabaseError(`Error marking scan as synced: ${error.message}`, error);
    }
    
    if (!data) {
      ProductDebug.error(`No data returned after marking scan as synced`, { scanId });
      throw new DatabaseError(`No data returned after marking scan as synced`);
    }
    
    ProductDebug.log(`Scan marked as synced successfully: ${scanId}`);
    return data;
  } catch (error) {
    ProductDebug.error(`Error marking scan as synced:`, { error, scanId });
    console.error('Error marking scan as synced:', error);
    throw error;
  }
}

/**
 * Mark multiple scans as synced
 * @param scanIds Array of scan IDs to mark as synced
 * @returns The number of scans that were successfully marked as synced
 */
export async function markScansAsSynced(scanIds: string[]): Promise<number> {
  if (!scanIds.length) {
    return 0;
  }
  
  ProductDebug.log(`Marking ${scanIds.length} scans as synced`);
  
  try {
    const { data, error } = await supabase
      .from('scans')
      .update({ 
        synced: true 
      } as any)
      .in('id', scanIds)
      .select('id');
    
    if (error) {
      ProductDebug.error(`Error marking scans as synced: ${error.message}`, { error, scanIds });
      throw new DatabaseError(`Error marking scans as synced: ${error.message}`, error);
    }
    
    const syncedCount = data?.length || 0;
    ProductDebug.log(`${syncedCount} scans marked as synced successfully`);
    return syncedCount;
  } catch (error) {
    ProductDebug.error(`Error marking scans as synced:`, { error, scanIds });
    console.error('Error marking scans as synced:', error);
    throw error;
  }
}

/**
 * Get unsynced scans for a user
 * @param userId The ID of the user
 * @param limit The maximum number of scans to return
 * @returns Array of unsynced scan records
 */
export async function getUnsyncedScans(userId: string, limit = 50): Promise<ScanHistory[]> {
  ProductDebug.log(`Getting unsynced scans for user: ${userId}, limit: ${limit}`);
  
  try {
    // Use any to bypass type checking for the database query
    const { data, error } = await (supabase
      .from('scans')
      .select('*')
      .eq('user_id', userId)
      .eq('synced', false)
      .order('scanned_at', { ascending: false })
      .limit(limit) as any);
    
    if (error) {
      ProductDebug.error(`Error getting unsynced scans:`, { error, userId });
      throw new DatabaseError(`Error getting unsynced scans: ${error.message}`, error);
    }
    
    if (!data || data.length === 0) {
      ProductDebug.log(`No unsynced scans found for user: ${userId}`);
      return [];
    }
    
    // Transform the raw data to match the ScanHistory interface
    const scanHistory: ScanHistory[] = [];
    
    for (const item of data) {
      const scan: ScanHistory = {
        id: item.id,
        product_id: item.product_id,
        user_id: item.user_id,
        scanned_at: item.scanned_at
      };
      
      // Add optional fields if they exist in the data
      if (item.source) {
        scan.source = item.source as 'cache' | 'database' | 'api';
      }
      
      if (item.synced !== undefined) {
        scan.synced = !!item.synced;
      }
      
      scanHistory.push(scan);
    }
    
    ProductDebug.log(`Found ${scanHistory.length} unsynced scans for user: ${userId}`);
    return scanHistory;
  } catch (error) {
    ProductDebug.error(`Error getting unsynced scans:`, { error, userId });
    console.error('Error getting unsynced scans:', error);
    throw error;
  }
}

/**
 * Sync unsynced scans for a user
 * @param userId The ID of the user
 * @param limit The maximum number of scans to sync
 * @returns The number of scans that were successfully synced
 */
export async function syncUnsyncedScans(userId: string, limit = 50): Promise<number> {
  ProductDebug.log(`Syncing unsynced scans for user: ${userId}, limit: ${limit}`);
  
  try {
    // Get unsynced scans
    const unsyncedScans = await getUnsyncedScans(userId, limit);
    
    if (unsyncedScans.length === 0) {
      return 0;
    }
    
    // Extract scan IDs
    const scanIds = unsyncedScans.map(scan => scan.id);
    
    // Mark scans as synced
    const syncedCount = await markScansAsSynced(scanIds);
    
    ProductDebug.log(`Synced ${syncedCount} scans for user: ${userId}`);
    return syncedCount;
  } catch (error) {
    ProductDebug.error(`Error syncing unsynced scans:`, { error, userId });
    console.error('Error syncing unsynced scans:', error);
    throw error;
  }
}