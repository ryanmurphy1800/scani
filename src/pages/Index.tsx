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
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { ProfileSettings } from "@/components/ProfileSettings";
import { ScanHistory } from "@/components/ScanHistory";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  const [manualBarcode, setManualBarcode] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();
  const { subscription } = useSubscription();

  useEffect(() => {
    // Add Apple-like background gradient
    document.body.classList.add('bg-gradient-to-b', 'from-blue-50', 'to-white', 'dark:from-gray-900', 'dark:to-gray-800');
    return () => {
      document.body.classList.remove('bg-gradient-to-b', 'from-blue-50', 'to-white', 'dark:from-gray-900', 'dark:to-gray-800');
    };
  }, []);

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
    <div className="animate-fade-in">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 glassmorphism border-b border-gray-200/80 dark:border-gray-800/80 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-2xl font-display font-bold text-blue-600 dark:text-blue-400">Scani</div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Home className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              className="rounded-full"
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/subscription')}
              className="rounded-full"
            >
              <CreditCard className="h-5 w-5" />
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="gap-2 rounded-full bg-blue-500 hover:bg-blue-600"
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2 rounded-full"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8 pb-16">
        {showSettings ? (
          <ProfileSettings />
        ) : (
          <>
            {/* Subscription Status */}
            <Card className="mb-8 ios-card bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-900/10 dark:to-indigo-900/10 backdrop-blur-sm border-blue-200/50 dark:border-blue-800/30">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                    <span className="font-medium">Subscription Status:</span>
                  </div>
                  <div>
                    {subscription?.status === 'active' ? (
                      <Badge className="bg-green-500 dark:bg-green-600 text-white font-medium px-2.5 py-0.5 rounded-full">Active</Badge>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate('/subscription')}
                        className="rounded-full text-sm"
                      >
                        Manage Subscription
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Scanner Section */}
            <Card className="mb-8 ios-card">
              <CardHeader>
                <CardTitle className="text-center font-display">
                  Scan Product
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6">
                <Button
                  onClick={() => handleScan("demo-barcode")}
                  size="lg"
                  className="h-32 w-32 rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 shadow-md flex items-center justify-center transition-all duration-200"
                >
                  <Scan className="h-12 w-12" />
                </Button>
                <form onSubmit={handleManualSubmit} className="w-full max-w-md mt-2">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Enter barcode number"
                      value={manualBarcode}
                      onChange={(e) => setManualBarcode(e.target.value)}
                      className="flex-1 ios-input"
                    />
                    <Button type="submit" variant="secondary" className="ios-button px-4">
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
