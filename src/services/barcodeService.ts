/**
 * Barcode scanning service for Scani
 * This service provides a platform-agnostic interface for barcode scanning
 * that can be implemented for web, React Native, or other platforms.
 */
import Quagga from 'quagga';

/**
 * Represents the result of a barcode scan
 */
export interface BarcodeResult {
  /** The barcode value (e.g., EAN-13, UPC-A code) */
  barcode: string;
  /** The format of the barcode (e.g., 'EAN-13', 'QR_CODE', 'UPC-A') */
  format: string;
  /** Timestamp when the barcode was scanned */
  timestamp: number;
}

/**
 * Callback function type for barcode detection
 */
export type BarcodeDetectedCallback = (result: BarcodeResult) => void;

/**
 * Configuration options for barcode scanning
 */
export interface BarcodeScannerOptions {
  /** Target element ID for the scanner (web only) */
  targetElementId?: string;
  /** Formats to detect (e.g., ['EAN-13', 'QR_CODE']) */
  formats?: string[];
  /** Whether to use the front camera (mobile only) */
  useFrontCamera?: boolean;
  /** Whether to play a sound on successful scan */
  playSound?: boolean;
  /** Whether to vibrate on successful scan (mobile only) */
  vibrate?: boolean;
  /** Whether to show debug information (boxes, etc.) */
  showDebug?: boolean;
  /** Minimum confidence threshold for accepting a barcode (0-1) */
  confidenceThreshold?: number;
}

/**
 * Interface for barcode scanners
 * This provides a common interface that can be implemented
 * for different platforms (web, React Native, etc.)
 */
export interface BarcodeScanner {
  /**
   * Start scanning for barcodes
   * @param options Configuration options for the scanner
   * @returns Promise that resolves when scanning has started
   */
  startScanning(options?: BarcodeScannerOptions): Promise<void>;
  
  /**
   * Stop scanning for barcodes
   * @returns Promise that resolves when scanning has stopped
   */
  stopScanning(): Promise<void>;
  
  /**
   * Register a callback to be called when a barcode is detected
   * @param callback Function to call when a barcode is detected
   */
  onBarcodeDetected(callback: BarcodeDetectedCallback): void;
  
  /**
   * Check if the device has the necessary hardware/permissions for scanning
   * @returns Promise that resolves to true if scanning is supported
   */
  isScanningSupported(): Promise<boolean>;
  
  /**
   * Request necessary permissions for barcode scanning
   * @returns Promise that resolves to true if permissions were granted
   */
  requestPermissions(): Promise<boolean>;
  
  /**
   * Pause scanning temporarily (without releasing resources)
   */
  pauseScanning(): void;
  
  /**
   * Resume scanning after it was paused
   */
  resumeScanning(): void;
  
  /**
   * Get the current scanning status
   * @returns Whether the scanner is currently active
   */
  isScanning(): boolean;
}

/**
 * Web implementation of the BarcodeScanner interface
 * This is a placeholder implementation that can be replaced with
 * an actual implementation using a library like QuaggaJS or ZXing
 */
export class WebBarcodeScanner implements BarcodeScanner {
  private scanning = false;
  private paused = false;
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private callback: BarcodeDetectedCallback | null = null;
  private quaggaInitialized = false;
  
  /**
   * Start scanning for barcodes using the device camera
   * @param options Configuration options for the scanner
   */
  async startScanning(options: BarcodeScannerOptions = {}): Promise<void> {
    if (this.scanning) {
      return;
    }
    
    // Check if browser supports getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Browser does not support camera access');
    }
    
    try {
      // Get target element
      const targetElement = options.targetElementId 
        ? document.getElementById(options.targetElementId)
        : null;
      
      if (options.targetElementId && !targetElement) {
        throw new Error(`Target element with ID "${options.targetElementId}" not found`);
      }
      
      // Create video element if not provided
      if (!targetElement) {
        this.videoElement = document.createElement('video');
        this.videoElement.style.position = 'absolute';
        this.videoElement.style.top = '0';
        this.videoElement.style.left = '0';
        this.videoElement.style.width = '100%';
        this.videoElement.style.height = '100%';
        this.videoElement.style.objectFit = 'cover';
        document.body.appendChild(this.videoElement);
      } else if (targetElement instanceof HTMLVideoElement) {
        this.videoElement = targetElement;
      } else {
        this.videoElement = document.createElement('video');
        this.videoElement.style.width = '100%';
        this.videoElement.style.height = '100%';
        targetElement.appendChild(this.videoElement);
      }
      
      // Get camera stream for fallback/preview
      const constraints = {
        video: {
          facingMode: options.useFrontCamera ? 'user' : 'environment',
        },
      };
      
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;
      this.videoElement.play();
      
      // Try to initialize Quagga for barcode detection
      try {
        await this.initQuagga(targetElement || document.body, options);
      } catch (quaggaError) {
        console.warn('Quagga initialization failed, falling back to mock detection:', quaggaError);
        // If Quagga fails, fall back to mock detection
        this.startMockDetection();
      }
      
      this.scanning = true;
      
      console.log('Barcode scanning started');
    } catch (error) {
      console.error('Error starting barcode scanner:', error);
      this.cleanup();
      throw error;
    }
  }
  
  /**
   * Stop scanning for barcodes and release resources
   */
  async stopScanning(): Promise<void> {
    if (this.quaggaInitialized) {
      Quagga.stop();
      this.quaggaInitialized = false;
    }
    this.cleanup();
    console.log('Barcode scanning stopped');
  }
  
  /**
   * Register a callback to be called when a barcode is detected
   * @param callback Function to call when a barcode is detected
   */
  onBarcodeDetected(callback: BarcodeDetectedCallback): void {
    this.callback = callback;
  }
  
  /**
   * Check if the device has the necessary hardware/permissions for scanning
   * @returns Promise that resolves to true if scanning is supported
   */
  async isScanningSupported(): Promise<boolean> {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
  
  /**
   * Request necessary permissions for barcode scanning
   * @returns Promise that resolves to true if permissions were granted
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop the stream immediately, we just needed to request permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Error requesting camera permissions:', error);
      return false;
    }
  }
  
  /**
   * Pause scanning temporarily (without releasing resources)
   */
  pauseScanning(): void {
    if (this.scanning && !this.paused) {
      this.paused = true;
      
      // Pause Quagga processing
      if (this.quaggaInitialized) {
        Quagga.pause();
      }
      
      console.log('Barcode scanning paused');
    }
  }
  
  /**
   * Resume scanning after it was paused
   */
  resumeScanning(): void {
    if (this.scanning && this.paused) {
      this.paused = false;
      
      // Resume Quagga processing
      if (this.quaggaInitialized) {
        Quagga.start();
      }
      
      console.log('Barcode scanning resumed');
    }
  }
  
  /**
   * Get the current scanning status
   * @returns Whether the scanner is currently active
   */
  isScanning(): boolean {
    return this.scanning && !this.paused;
  }
  
  /**
   * Clean up resources used by the scanner
   * @private
   */
  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.videoElement && this.videoElement.parentNode) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
      // Only remove if we created it
      if (this.videoElement.parentNode === document.body) {
        this.videoElement.parentNode.removeChild(this.videoElement);
      }
    }
    
    if (this.quaggaInitialized) {
      Quagga.stop();
      this.quaggaInitialized = false;
    }
    
    this.videoElement = null;
    this.scanning = false;
    this.paused = false;
  }
  
  /**
   * Initialize Quagga barcode detection
   * @param targetElement The element to render the scanner into
   * @param options Configuration options for the scanner
   * @private
   */
  private async initQuagga(targetElement: HTMLElement, options: BarcodeScannerOptions): Promise<void> {
    // Use default confidence threshold if not provided
    const confidenceThreshold = options.confidenceThreshold !== undefined 
      ? options.confidenceThreshold 
      : 0.75;
      
    return new Promise((resolve, reject) => {
      // Create a container for Quagga if the target is not already a div
      let quaggaContainer: HTMLElement;
      if (targetElement.tagName === 'DIV') {
        quaggaContainer = targetElement;
      } else {
        quaggaContainer = document.createElement('div');
        quaggaContainer.style.position = 'absolute';
        quaggaContainer.style.top = '0';
        quaggaContainer.style.left = '0';
        quaggaContainer.style.width = '100%';
        quaggaContainer.style.height = '100%';
        quaggaContainer.style.zIndex = '1';
        targetElement.appendChild(quaggaContainer);
      }
      
      // Configure Quagga
      Quagga.init({
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: quaggaContainer,
          constraints: {
            facingMode: options.useFrontCamera ? 'user' : 'environment',
            width: { min: 640 },
            height: { min: 480 },
            aspectRatio: { min: 1, max: 2 },
          },
          area: { // Only analyze the center area of the video
            top: "20%",
            right: "20%",
            left: "20%",
            bottom: "20%",
          },
        },
        locator: {
          patchSize: 'medium',
          halfSample: true,
        },
        numOfWorkers: navigator.hardwareConcurrency || 4,
        frequency: 10, // How many frames to process per second
        decoder: {
          readers: this.getReadersFromFormats(options.formats),
          debug: {
            showCanvas: options.showDebug || false,
            showPatches: options.showDebug || false,
            showFoundPatches: options.showDebug || false,
            showSkeleton: options.showDebug || false,
            showLabels: options.showDebug || false,
            showPatchLabels: options.showDebug || false,
            showRemainingPatchLabels: options.showDebug || false,
          }
        },
        locate: true,
        multiple: false, // Only detect one barcode at a time
      }, (err) => {
        if (err) {
          console.error('Error initializing Quagga:', err);
          reject(err);
          return;
        }
        
        // Register result callback
        Quagga.onDetected((result) => {
          if (this.callback && this.scanning && !this.paused) {
            const code = result.codeResult.code;
            const format = result.codeResult.format;
            
            if (code) {
              // Only accept results with a minimum confidence level
              if (result.codeResult.confidence >= confidenceThreshold) {
                const barcodeResult: BarcodeResult = {
                  barcode: code,
                  format: format,
                  timestamp: Date.now(),
                };
                
                this.callback(barcodeResult);
                
                // Play a sound if enabled
                if (options.playSound) {
                  this.playBeepSound();
                }
                
                // Optionally pause scanning after a successful detection
                // to avoid multiple rapid detections of the same barcode
                this.pauseScanning();
                setTimeout(() => {
                  if (this.scanning) {
                    this.resumeScanning();
                  }
                }, 1000);
              } else {
                console.log(`Low confidence barcode detected (${result.codeResult.confidence.toFixed(2)}): ${code}`);
              }
            }
          }
        });
        
        // Optionally register processing callback for debugging
        if (options.showDebug) {
          Quagga.onProcessed((result) => {
            const drawingCtx = Quagga.canvas.ctx.overlay;
            const drawingCanvas = Quagga.canvas.dom.overlay;
            
            if (result) {
              // Draw locator boxes for debugging
              if (result.boxes) {
                drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
                result.boxes.filter((box) => box !== result.box).forEach((box) => {
                  Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, { color: 'green', lineWidth: 2 });
                });
              }
              
              // Draw the main box in red
              if (result.box) {
                Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: 'red', lineWidth: 2 });
              }
            }
          });
        }
        
        // Start Quagga
        Quagga.start();
        this.quaggaInitialized = true;
        resolve();
      });
    });
  }
  
  /**
   * Get the appropriate Quagga readers based on the requested formats
   * @param formats The barcode formats to detect
   * @returns Array of Quagga reader names
   * @private
   */
  private getReadersFromFormats(formats?: string[]): string[] {
    if (!formats || formats.length === 0) {
      // Default to common formats if none specified
      return [
        'ean_reader',
        'ean_8_reader',
        'upc_reader',
        'upc_e_reader',
        'code_39_reader',
        'code_128_reader',
      ];
    }
    
    const formatMap: Record<string, string> = {
      'EAN-13': 'ean_reader',
      'EAN-8': 'ean_8_reader',
      'UPC-A': 'upc_reader',
      'UPC-E': 'upc_e_reader',
      'CODE-39': 'code_39_reader',
      'CODE-128': 'code_128_reader',
      'QR_CODE': 'qr_code_reader',
      'CODABAR': 'codabar_reader',
      'ITF': 'i2of5_reader',
    };
    
    return formats
      .map(format => formatMap[format] || null)
      .filter((reader): reader is string => reader !== null);
  }
  
  /**
   * Play a beep sound when a barcode is detected
   * @private
   */
  private playBeepSound(): void {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.value = 1800;
      gainNode.gain.value = 0.5;
      
      oscillator.start();
      
      // Beep for 100ms
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 100);
    } catch (error) {
      console.error('Error playing beep sound:', error);
    }
  }

  /**
   * Mock function to simulate barcode detection
   * This is used as a fallback when Quagga initialization fails
   * @private
   */
  private startMockDetection(): void {
    // This is just a placeholder to simulate barcode detection
    if (this.callback) {
      // Simulate detecting a barcode after a random delay
      setTimeout(() => {
        if (this.scanning && !this.paused && this.callback) {
          const mockFormats = ['EAN-13', 'UPC-A', 'QR_CODE'];
          const mockBarcodes = ['5901234123457', '036000291452', '8410054035423'];
          
          const result: BarcodeResult = {
            barcode: mockBarcodes[Math.floor(Math.random() * mockBarcodes.length)],
            format: mockFormats[Math.floor(Math.random() * mockFormats.length)],
            timestamp: Date.now(),
          };
          
          this.callback(result);
          
          // Play a sound if enabled
          this.playBeepSound();
          
          // Continue with mock detection if still scanning
          if (this.scanning && !this.paused) {
            this.startMockDetection();
          }
        }
      }, 2000 + Math.random() * 3000);
    }
  }
}

/**
 * Factory function to get the appropriate barcode scanner implementation
 * based on the current platform
 * @returns A barcode scanner implementation
 */
export function getBarcodeScanner(): BarcodeScanner {
  // For now, we only have a web implementation
  // In the future, we could detect the platform and return the appropriate implementation
  // e.g., if (isReactNative()) return new ReactNativeBarcodeScanner();
  
  return new WebBarcodeScanner();
}

/**
 * Helper function to determine if we're running in a React Native environment
 * @returns Whether the code is running in React Native
 */
function isReactNative(): boolean {
  // Check if we're running in React Native
  return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
}

/**
 * Helper function to format a barcode for display
 * @param barcode The barcode to format
 * @returns The formatted barcode
 */
export function formatBarcode(barcode: string): string {
  // Format the barcode for display (e.g., add spaces or dashes)
  // This is just a simple example
  if (barcode.length === 13) {
    // EAN-13 format: first digit, then group of 6, then group of 6
    return `${barcode.substring(0, 1)} ${barcode.substring(1, 7)} ${barcode.substring(7)}`;
  } else if (barcode.length === 12) {
    // UPC-A format: group of 6, then group of 6
    return `${barcode.substring(0, 6)} ${barcode.substring(6)}`;
  }
  
  return barcode;
}

/**
 * Validate a barcode using check digit algorithms
 * @param barcode The barcode to validate
 * @param format The format of the barcode
 * @returns Whether the barcode is valid
 */
export function validateBarcode(barcode: string, format: string): boolean {
  // Implement validation logic for different barcode formats
  // This is a simplified example for EAN-13
  if (format === 'EAN-13' && barcode.length === 13) {
    // EAN-13 check digit calculation
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(barcode.charAt(i), 10);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return parseInt(barcode.charAt(12), 10) === checkDigit;
  }
  
  // For other formats or if we don't have validation logic, return true
  return true;
} 