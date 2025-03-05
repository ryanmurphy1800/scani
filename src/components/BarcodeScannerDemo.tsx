import React, { useState } from 'react';
import { BarcodeScanner } from './BarcodeScanner';
import { NetworkStatus } from './ui/NetworkStatus';
import { QueueMonitor } from './ui/QueueMonitor';
import { SyncButton } from './ui/SyncButton';
import { formatBarcode } from '@/services/barcodeService';

export function BarcodeScannerDemo() {
  const [userId] = useState('demo-user-123');
  const [lastScannedProduct, setLastScannedProduct] = useState<any>(null);
  const [lastScan, setLastScan] = useState<any>(null);
  const [productSource, setProductSource] = useState<string>('');
  const [error, setError] = useState<Error | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.75);
  
  const handleProductFound = (product: any, scan: any, source: string) => {
    setLastScannedProduct(product);
    setLastScan(scan);
    setProductSource(source);
    setError(null);
  };
  
  const handleError = (error: Error) => {
    setError(error);
  };
  
  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Barcode Scanner Demo</h1>
      
      <div className="mb-4 flex items-center justify-between">
        <NetworkStatus showDetails={true} />
        <SyncButton variant="outline" size="sm" showStatus={true} />
      </div>
      
      <div className="grid gap-6">
        {/* Scanner Section */}
        <section className="bg-white rounded-lg border shadow-sm">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Scan a Product</h2>
            <p className="text-sm text-gray-500 mt-1">
              Point your camera at a barcode to scan it
            </p>
          </div>
          
          <div className="p-4">
            <BarcodeScanner
              targetElementId="demo-scanner"
              userId={userId}
              showDebug={showDebug}
              confidenceThreshold={confidenceThreshold}
              onProductFound={handleProductFound}
              onError={handleError}
            />
            
            <div className="mt-4 space-y-3">
              {/* Debug toggle */}
              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDebug}
                    onChange={(e) => setShowDebug(e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Show Debug Information</span>
                </label>
                
                {showDebug && (
                  <div className="ml-4 text-xs text-gray-500">
                    Green boxes: Potential barcodes | Red box: Selected barcode
                  </div>
                )}
              </div>
              
              {/* Confidence threshold slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-gray-700">
                    Confidence Threshold: {(confidenceThreshold * 100).toFixed(0)}%
                  </label>
                  <button
                    onClick={() => setConfidenceThreshold(0.75)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Reset to Default
                  </button>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>More Results</span>
                  <span>Higher Accuracy</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Results Section */}
        {lastScannedProduct && (
          <section className="bg-white rounded-lg border shadow-sm p-4">
            <h2 className="text-lg font-semibold mb-3">Last Scanned Product</h2>
            
            <div className="grid gap-4 md:grid-cols-2">
              {/* Product Image */}
              <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center">
                {lastScannedProduct.image_url ? (
                  <img 
                    src={lastScannedProduct.image_url} 
                    alt={lastScannedProduct.name}
                    className="max-h-48 object-contain"
                  />
                ) : (
                  <div className="text-gray-400 text-center">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-16 w-16 mx-auto mb-2" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={1} 
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                      />
                    </svg>
                    <p>No image available</p>
                  </div>
                )}
              </div>
              
              {/* Product Details */}
              <div>
                <h3 className="font-semibold text-xl mb-2">{lastScannedProduct.name}</h3>
                <p className="text-gray-600 mb-4">{lastScannedProduct.brand}</p>
                
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Barcode:</span>
                    <span className="ml-2 font-mono">{formatBarcode(lastScannedProduct.barcode)}</span>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-500">Safety Score:</span>
                    <span className="ml-2">
                      <span className={`font-medium ${getSafetyScoreColor(lastScannedProduct.safety_score)}`}>
                        {lastScannedProduct.safety_score}/10
                      </span>
                    </span>
                  </div>
                  
                  {productSource && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">Source:</span>
                      <span className="ml-2">
                        <span className={`text-sm font-medium ${getSourceColor(productSource)}`}>
                          {productSource.charAt(0).toUpperCase() + productSource.slice(1)}
                        </span>
                      </span>
                    </div>
                  )}
                  
                  {lastScannedProduct.tags && lastScannedProduct.tags.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">Tags:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {lastScannedProduct.tags.map((tag: string, index: number) => (
                          <span 
                            key={index}
                            className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {lastScan && (
                    <div className="pt-2 mt-2 border-t border-gray-100">
                      <span className="text-sm font-medium text-gray-500">Scanned:</span>
                      <span className="ml-2 text-sm text-gray-600">
                        {new Date(lastScan.scanned_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
        
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-700 font-medium mb-1">Error</h3>
            <p className="text-red-600">{error.message}</p>
          </div>
        )}
        
        {/* Queue Monitor */}
        <section className="bg-white rounded-lg border shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-3">Operation Queue</h2>
          <QueueMonitor compact={true} />
        </section>
      </div>
    </div>
  );
}

function getSafetyScoreColor(score: number): string {
  if (score >= 8) return 'text-green-600';
  if (score >= 6) return 'text-yellow-600';
  if (score >= 4) return 'text-orange-600';
  return 'text-red-600';
}

function getSourceColor(source: string): string {
  switch (source) {
    case 'cache':
      return 'text-purple-600';
    case 'database':
      return 'text-blue-600';
    case 'api':
      return 'text-green-600';
    default:
      return 'text-gray-600';
  }
} 