import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getBarcodeScanner, 
  BarcodeResult, 
  BarcodeScannerOptions,
  BarcodeScanner
} from '@/services/barcodeService';

interface BarcodeScannerHookOptions extends BarcodeScannerOptions {
  /** Whether to automatically start scanning when the component mounts */
  autoStart?: boolean;
  /** Whether to automatically request permissions when needed */
  autoRequestPermissions?: boolean;
}

interface BarcodeScannerHookResult {
  /** Start the barcode scanner */
  startScanning: () => Promise<void>;
  /** Stop the barcode scanner */
  stopScanning: () => Promise<void>;
  /** Pause the barcode scanner temporarily */
  pauseScanning: () => void;
  /** Resume the barcode scanner after pausing */
  resumeScanning: () => void;
  /** The most recently scanned barcode result */
  lastResult: BarcodeResult | null;
  /** Whether the scanner is currently active */
  isScanning: boolean;
  /** Whether the scanner is supported on this device */
  isSupported: boolean;
  /** Whether the scanner has the necessary permissions */
  hasPermissions: boolean;
  /** Whether the scanner is currently initializing */
  isInitializing: boolean;
  /** Any error that occurred during scanning */
  error: Error | null;
  /** Request camera permissions */
  requestPermissions: () => Promise<boolean>;
}

/**
 * React hook for using the barcode scanner in components
 * @param options Configuration options for the scanner
 * @returns Object with scanner controls and state
 */
export function useBarcodeSanner(
  options: BarcodeScannerHookOptions = {}
): BarcodeScannerHookResult {
  const [lastResult, setLastResult] = useState<BarcodeResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Use a ref to store the scanner instance to avoid recreating it on each render
  const scannerRef = useRef<BarcodeScanner | null>(null);
  
  // Initialize the scanner
  useEffect(() => {
    let mounted = true;
    
    const initScanner = async () => {
      try {
        // Get the scanner instance
        const scanner = getBarcodeScanner();
        scannerRef.current = scanner;
        
        // Check if scanning is supported
        const supported = await scanner.isScanningSupported();
        if (mounted) {
          setIsSupported(supported);
        }
        
        // Auto-request permissions if enabled
        if (supported && options.autoRequestPermissions) {
          const permissionsGranted = await scanner.requestPermissions();
          if (mounted) {
            setHasPermissions(permissionsGranted);
          }
        }
        
        // Register the callback for barcode detection
        scanner.onBarcodeDetected((result) => {
          if (mounted) {
            setLastResult(result);
          }
        });
        
        // Auto-start scanning if enabled
        if (supported && options.autoStart) {
          await scanner.startScanning(options);
          if (mounted) {
            setIsScanning(true);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (mounted) {
          setIsInitializing(false);
        }
      }
    };
    
    initScanner();
    
    // Clean up when the component unmounts
    return () => {
      mounted = false;
      if (scannerRef.current && scannerRef.current.isScanning()) {
        scannerRef.current.stopScanning().catch(console.error);
      }
    };
  }, [options]);
  
  // Start scanning function
  const startScanning = useCallback(async () => {
    if (!scannerRef.current) {
      throw new Error('Scanner not initialized');
    }
    
    try {
      setError(null);
      await scannerRef.current.startScanning(options);
      setIsScanning(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    }
  }, [options]);
  
  // Stop scanning function
  const stopScanning = useCallback(async () => {
    if (!scannerRef.current) {
      return;
    }
    
    try {
      await scannerRef.current.stopScanning();
      setIsScanning(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    }
  }, []);
  
  // Pause scanning function
  const pauseScanning = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.pauseScanning();
      setIsScanning(false);
    }
  }, []);
  
  // Resume scanning function
  const resumeScanning = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.resumeScanning();
      setIsScanning(true);
    }
  }, []);
  
  // Request permissions function
  const requestPermissions = useCallback(async () => {
    if (!scannerRef.current) {
      throw new Error('Scanner not initialized');
    }
    
    try {
      const permissionsGranted = await scannerRef.current.requestPermissions();
      setHasPermissions(permissionsGranted);
      return permissionsGranted;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    }
  }, []);
  
  return {
    startScanning,
    stopScanning,
    pauseScanning,
    resumeScanning,
    lastResult,
    isScanning,
    isSupported,
    hasPermissions,
    isInitializing,
    error,
    requestPermissions,
  };
} 