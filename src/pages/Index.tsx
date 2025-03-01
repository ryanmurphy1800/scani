
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Home, 
  Plus, 
  Scan, 
  ScanBarcode, 
  LogOut,
  Settings,
  CreditCard
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { ProfileSettings } from "@/components/ProfileSettings";
import { ScanHistory } from "@/components/ScanHistory";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";

const Index = () => {
  const [manualBarcode, setManualBarcode] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();
  const { subscription } = useSubscription();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/auth");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleScan = async (barcode: string) => {
    if (!session?.user) return;

    try {
      // First, check if the product exists
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("barcode", barcode)
        .single();

      if (productError && productError.code !== "PGRST116") {
        throw productError;
      }

      let productId = product?.id;

      // If product doesn't exist, create it (in a real app, you'd fetch product data from an API)
      if (!product) {
        const { data: newProduct, error: createError } = await supabase
          .from("products")
          .insert({
            name: "Unknown Product",
            brand: "Unknown Brand",
            barcode,
            safety_score: 50,
            tags: [],
          })
          .select()
          .single();

        if (createError) throw createError;
        productId = newProduct.id;
      }

      // Record the scan
      const { error: scanError } = await supabase
        .from("scans")
        .insert({
          user_id: session.user.id,
          product_id: productId,
        });

      if (scanError) throw scanError;

      toast({
        title: "Success",
        description: "Product scanned successfully",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleScan(manualBarcode);
    setManualBarcode("");
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
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/subscription')}
            >
              <CreditCard className="h-5 w-5" />
            </Button>
            <Button variant="default" size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Add Product
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {showSettings ? (
          <ProfileSettings />
        ) : (
          <>
            {/* Subscription Status */}
            <Card className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold">Subscription Status:</span>
                  </div>
                  <div>
                    {subscription?.status === 'active' ? (
                      <Badge className="bg-green-500">Active</Badge>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate('/subscription')}
                      >
                        Manage Subscription
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Scanner Section */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-center">
                  Scan Product
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <Button
                  onClick={() => handleScan("demo-barcode")}
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

            {/* Scan History */}
            <ScanHistory />
          </>
        )}
      </div>
    </div>
  );
};

export default Index;

// Missing import
import { Badge } from "@/components/ui/badge";
