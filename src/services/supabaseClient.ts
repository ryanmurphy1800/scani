import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { Product, ScanHistory } from './productService';

/**
 * Get the current authenticated user
 * @returns The user data or null if not authenticated
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Get the user's profile data, creating a new profile if one doesn't exist
 * @param userId The user ID
 * @returns The user's profile data or null if an error occurred
 */
export async function getUserProfile(userId: string) {
  try {
    // First, try to fetch the existing profile
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    // If profile exists, return it
    if (data) {
      return data;
    }
    
    // If error is not "No rows found" (PGRST116), it's a different error
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user profile:', error);
      return null;
    }
    
    // No profile found, create a new one
    console.log('No profile found for user, creating new profile:', userId);
    
    // Generate a default username from the user ID
    const defaultUsername = `user_${userId.substring(0, 8)}`;
    
    // Create a new profile
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        username: defaultUsername,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Error creating user profile:', createError);
      return null;
    }
    
    return newProfile;
  } catch (error) {
    console.error('Unexpected error in getUserProfile:', error);
    return null;
  }
}

/**
 * Update the user's profile data
 * @param userId The user ID to update the profile for
 * @param profileData The profile data to update
 * @returns The updated profile data
 */
export async function updateUserProfile(userId: string, profileData: { username?: string }) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...profileData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
  
  return data;
}

/**
 * Get the user's subscription status
 * @param userId The user ID to get the subscription for
 * @returns The subscription data or null if not found
 */
export async function getUserSubscription(userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();
  
  if (error) {
    // If no subscription found, return null
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching user subscription:', error);
    throw error;
  }
  
  return data;
}

/**
 * Get popular products based on scan count
 * @param limit The maximum number of products to return
 * @returns Array of products with their scan counts
 */
export async function getPopularProducts(limit = 10): Promise<{ product: Product; scanCount: number }[]> {
  // Using a simpler approach - get all scans and count them in memory
  const { data: scans, error } = await supabase
    .from('scans')
    .select('product_id, products(*)') 
    .limit(500); // Get a reasonable number of recent scans
  
  if (error) {
    console.error('Error fetching scans for popular products:', error);
    throw error;
  }
  
  if (!scans || scans.length === 0) {
    return [];
  }
  
  // Count occurrences of each product
  const productCounts: Record<string, { product: Product; count: number }> = {};
  
  scans.forEach(scan => {
    const productId = scan.product_id;
    const product = scan.products as unknown as Product;
    
    if (!productCounts[productId]) {
      productCounts[productId] = { product, count: 0 };
    }
    
    productCounts[productId].count += 1;
  });
  
  // Convert to array, sort by count, and return top results
  return Object.values(productCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(item => ({ 
      product: item.product, 
      scanCount: item.count 
    }));
}

/**
 * Search for products by name or brand
 * @param query The search query
 * @param limit The maximum number of products to return
 * @returns Array of matching products
 */
export async function searchProducts(query: string, limit = 10): Promise<Product[]> {
  // Using Postgres ilike for case-insensitive search
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .or(`name.ilike.%${query}%,brand.ilike.%${query}%`)
    .limit(limit);
  
  if (error) {
    console.error('Error searching products:', error);
    throw error;
  }
  
  return data;
}

/**
 * Get recent scans for the current user
 * @param userId The user ID
 * @param limit The maximum number of scans to return
 * @returns Array of recent scans with product data
 */
export async function getRecentScans(userId: string, limit = 10): Promise<ScanHistory[]> {
  const { data, error } = await supabase
    .from('scans')
    .select(`
      *,
      product:products(*)
    `)
    .eq('user_id', userId)
    .order('scanned_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching recent scans:', error);
    throw error;
  }
  
  return data;
}

// Export the supabase client for direct access if needed
export { supabase }; 