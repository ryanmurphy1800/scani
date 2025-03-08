import { initProductDebugging } from '@/services/productService';

/**
 * Initialize all debugging tools for the application
 * This should be called once during app initialization
 */
export function initDebugging(): void {
  // Initialize product debugging tools
  initProductDebugging();
  
  // Add more debugging initializations here as needed
  
  // Log that debugging is initialized
  console.log('🔧 Debugging tools initialized');
}

// Auto-initialize in development mode
if (process.env.NODE_ENV === 'development') {
  initDebugging();
}

// Make debugging tools available globally
if (typeof window !== 'undefined') {
  (window as any).initDebugging = initDebugging;
} 