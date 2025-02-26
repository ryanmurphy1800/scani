
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scan, ScanBarcode } from "lucide-react";
import { useState } from "react";

const Index = () => {
  const [manualBarcode, setManualBarcode] = useState("");

  const handleScan = () => {
    // Placeholder for future scanner implementation
    console.log("Scan initiated");
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder for future barcode processing
    console.log("Manual barcode submitted:", manualBarcode);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-md">
        <h1 className="mb-8 text-center text-3xl font-bold tracking-tight">
          Scani
        </h1>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center text-xl">
              Scan Barcode
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Button
              onClick={handleScan}
              size="lg"
              className="h-32 w-32 rounded-full"
            >
              <Scan className="h-12 w-12" />
            </Button>
            <p className="text-sm text-muted-foreground">
              Tap to scan a barcode
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-center text-xl">
              Manual Entry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter barcode number"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" variant="secondary">
                  <ScanBarcode className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
