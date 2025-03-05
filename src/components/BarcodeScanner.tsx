import React, { useState, useEffect } from 'react';
import { useBarcodeSanner } from '@/hooks/use-barcode-scanner';
import { formatBarcode, validateBarcode } from '@/services/barcodeService';
import { processBarcodeScan } from '@/services/productService';

interface BarcodeScannerProps {
  /** ID of the element to render the scanner into */
  targetElementId?: string;
  /** Whether to use the front camera */
  useFrontCamera?: boolean;
  /** Whether to play a sound on successful scan */
  playSound?: boolean;
  /** Whether to automatically start scanning */
  autoStart?: boolean;
  /** User ID for recording scans */
  userId?: string;
  /** Whether to show debug information */
  showDebug?: boolean;
  /** Minimum confidence threshold for accepting a barcode (0-1) */
  confidenceThreshold?: number;
  /** Callback when a product is found */
  onProductFound?: (product: any, scan: any, source: string) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

// Define the scanning animation as a CSS class
const scanlineAnimation = `
  @keyframes scanline {
    0% {
      transform: translateY(0%);
    }
    50% {
      transform: translateY(1000%);
    }
    100% {
      transform: translateY(0%);
    }
  }
  
  .scanline-animation {
    animation: scanline 2s ease-in-out infinite;
  }
`;

export function BarcodeScanner({
  targetElementId,
  useFrontCamera = false,
  playSound = true,
  autoStart = true,
  userId,
  showDebug = false,
  confidenceThreshold = 0.75,
  onProductFound,
  onError
}: BarcodeScannerProps) {
  const [processing, setProcessing] = useState(false);
  const [lastProcessedBarcode, setLastProcessedBarcode] = useState<string | null>(null);
  
  // Use the barcode scanner hook
  const {
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
    requestPermissions
  } = useBarcodeSanner({
    targetElementId,
    useFrontCamera,
    playSound,
    autoStart,
    autoRequestPermissions: true,
    showDebug,
    confidenceThreshold
  });
  
  // Process the barcode when a new one is scanned
  useEffect(() => {
    if (
      lastResult && 
      !processing && 
      lastResult.barcode !== lastProcessedBarcode &&
      validateBarcode(lastResult.barcode, lastResult.format)
    ) {
      const processBarcode = async () => {
        try {
          setProcessing(true);
          
          // Pause scanning while processing
          pauseScanning();
          
          // Process the barcode
          const result = await processBarcodeScan(lastResult.barcode, userId);
          
          // Save the processed barcode to avoid processing it again
          setLastProcessedBarcode(lastResult.barcode);
          
          // Call the callback if provided
          if (onProductFound) {
            onProductFound(result.product, result.scan, result.source);
          }
          
          // Resume scanning after a short delay
          setTimeout(() => {
            resumeScanning();
            setProcessing(false);
          }, 1500);
        } catch (err) {
          setProcessing(false);
          resumeScanning();
          
          const error = err instanceof Error ? err : new Error(String(err));
          
          if (onError) {
            onError(error);
          } else {
            console.error('Error processing barcode:', error);
          }
        }
      };
      
      processBarcode();
    }
  }, [
    lastResult, 
    userId, 
    processing, 
    lastProcessedBarcode, 
    pauseScanning, 
    resumeScanning, 
    onProductFound, 
    onError
  ]);
  
  // Handle errors from the scanner
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);
  
  if (!isSupported) {
    return (
      <div className="p-4 text-center bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600 font-medium">
          Barcode scanning is not supported on this device.
        </p>
        <p className="text-sm text-red-500 mt-1">
          Your device may not have a camera or your browser doesn't support the required features.
        </p>
      </div>
    );
  }
  
  if (!hasPermissions && !isInitializing) {
    return (
      <div className="p-4 text-center bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-700 font-medium">
          Camera permission is required for barcode scanning.
        </p>
        <button
          onClick={() => requestPermissions()}
          className="mt-2 px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-md"
        >
          Grant Camera Permission
        </button>
      </div>
    );
  }
  
  return (
    <div className="relative">
      {/* Add the scanline animation CSS */}
      <style dangerouslySetInnerHTML={{ __html: scanlineAnimation }} />
      
      {/* Scanner container - the video will be rendered into the element with the provided ID */}
      <div 
        id={targetElementId || 'barcode-scanner'} 
        className="w-full aspect-video bg-black rounded-lg overflow-hidden"
      />
      
      {/* Scanner overlay with controls */}
      <div className="absolute inset-0 pointer-events-none flex flex-col">
        {/* Scanning indicator */}
        <div className="flex-1 flex items-center justify-center">
          {isInitializing ? (
            <div className="bg-black/50 text-white px-4 py-2 rounded-full">
              Initializing camera...
            </div>
          ) : processing ? (
            <div className="bg-blue-500/70 text-white px-4 py-2 rounded-full animate-pulse">
              Processing barcode...
            </div>
          ) : isScanning ? (
            <div className="w-full max-w-xs h-0.5 bg-red-500 scanline-animation" />
          ) : (
            <div className="bg-black/50 text-white px-4 py-2 rounded-full">
              Scanner paused
            </div>
          )}
        </div>
        
        {/* Last scanned barcode */}
        {lastResult && (
          <div className="bg-black/70 text-white p-3 text-center">
            <div className="text-xs uppercase tracking-wide opacity-70">Last Scanned</div>
            <div className="font-mono text-lg">{formatBarcode(lastResult.barcode)}</div>
            <div className="text-xs opacity-70">{lastResult.format}</div>
          </div>
        )}
      </div>
      
      {/* Scanner controls */}
      <div className="mt-4 flex justify-center gap-3">
        {isScanning ? (
          <button
            onClick={() => stopScanning()}
            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md"
          >
            Stop Scanner
          </button>
        ) : (
          <button
            onClick={() => startScanning()}
            className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-md"
          >
            Start Scanner
          </button>
        )}
        
        {isScanning && (
          <button
            onClick={() => pauseScanning()}
            className="px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-md"
          >
            Pause
          </button>
        )}
        
        {!isScanning && !isInitializing && (
          <button
            onClick={() => resumeScanning()}
            className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md"
          >
            Resume
          </button>
        )}
      </div>
    </div>
  );
} 