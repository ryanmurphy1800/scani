
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Home, 
  UserCircle, 
  Plus, 
  Scan, 
  ScanBarcode, 
  Droplet, 
  Sun, 
  Eye, 
  Heart
} from "lucide-react";
import { useState } from "react";

interface Product {
  name: string;
  brand: string;
  safetyScore: number;
  tags: string[];
  timestamp?: string;
  status?: "safe" | "moderate" | "harmful";
}

const Index = () => {
  const [manualBarcode, setManualBarcode] = useState("");

  const trendingProducts: Product[] = [
    {
      name: "Night Cream",
      brand: "Eco Glow",
      safetyScore: 92,
      tags: ["All-natural", "No sulfates"]
    },
    {
      name: "Hydrating Serum",
      brand: "Aqua Boost",
      safetyScore: 97,
      tags: ["Hypoallergenic", "Vegan"]
    },
    {
      name: "Gentle Cleanser",
      brand: "Soft Touch",
      safetyScore: 94,
      tags: ["pH balanced", "No harsh chemicals"]
    }
  ];

  const recentScans: Product[] = [
    {
      name: "Daily Moisturizer",
      brand: "Natural Care",
      timestamp: "2 hours ago",
      safetyScore: 92,
      status: "safe",
      tags: []
    },
    {
      name: "Facial Cleanser",
      brand: "Pure Beauty",
      timestamp: "5 hours ago",
      safetyScore: 75,
      status: "moderate",
      tags: []
    },
    {
      name: "Night Serum",
      brand: "Skin Science",
      timestamp: "1 day ago",
      safetyScore: 88,
      status: "safe",
      tags: []
    }
  ];

  const handleScan = () => {
    console.log("Scan initiated");
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Manual barcode submitted:", manualBarcode);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-2xl font-bold text-blue-600">Scani</div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Home className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <UserCircle className="h-5 w-5" />
            </Button>
            <Button variant="default" size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-blue-50 px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Beauty Has Nothing to Hide
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Most beauty labels don't tell the full story. Find trusted products with our science-based analysis.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              Download iOS App
            </Button>
            <Button size="lg" variant="outline">
              Download Android App
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Trusted by 100K+ beauty enthusiasts
          </p>
        </div>
      </div>

      {/* Scanner Section */}
      <div className="max-w-md mx-auto px-4 py-8">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-center text-xl">
              Scan Product
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Button
              onClick={handleScan}
              size="lg"
              className="h-32 w-32 rounded-full bg-gray-900 hover:bg-gray-800"
            >
              <Scan className="h-12 w-12" />
            </Button>
            <form onSubmit={handleManualSubmit} className="w-full">
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

        {/* Trending Products */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Trending</h2>
          <div className="grid gap-4">
            {trendingProducts.map((product, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">{product.name}</h3>
                      <p className="text-sm text-gray-500">{product.brand}</p>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      {product.safetyScore}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.tags.map((tag, tagIndex) => (
                      <Badge key={tagIndex} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Recent Scans */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Recent Scans</h2>
          <Card>
            <CardContent className="p-4">
              {recentScans.map((scan, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between py-3 ${
                    index !== recentScans.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  <div>
                    <h3 className="font-medium">{scan.name}</h3>
                    <p className="text-sm text-gray-500">{scan.timestamp}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-semibold">{scan.safetyScore}</span>
                    <Badge
                      variant={scan.status === "safe" ? "default" : scan.status === "moderate" ? "secondary" : "destructive"}
                    >
                      {scan.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* Stats Section */}
        <section className="text-center py-8 border-t border-gray-100">
          <h2 className="text-3xl font-bold mb-2">50,000+ products scanned today</h2>
          <p className="text-gray-600">
            Join thousands of beauty enthusiasts making informed decisions
          </p>
        </section>
      </div>
    </div>
  );
};

export default Index;
