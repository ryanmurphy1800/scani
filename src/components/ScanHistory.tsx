
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import type { Scan } from "@/types/database";
import { Package, ClipboardList } from "lucide-react";

export const ScanHistory = () => {
  const { session } = useAuth();

  const { data: scans, isLoading, error } = useQuery({
    queryKey: ["scans"],
    queryFn: async () => {
      console.log("Fetching scans for user:", session?.user?.id);
      
      const { data, error } = await supabase
        .from("scans")
        .select(`
          *,
          product:products(*)
        `)
        .eq("user_id", session?.user?.id)
        .order("scanned_at", { ascending: false });

      console.log("Scans query result:", { data, error });
      
      if (error) throw error;
      return data as (Scan)[];
    },
    enabled: !!session?.user?.id,
  });

  if (isLoading) {
    return (
      <Card className="ios-card">
        <CardHeader className="bg-gray-50/70 dark:bg-gray-800/20 backdrop-blur-sm border-b border-gray-200/70 dark:border-gray-700/30">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            <CardTitle className="text-xl font-display">Scan History</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500 dark:text-gray-400">
              <div className="h-8 w-8 rounded-full border-2 border-t-transparent border-gray-300 animate-spin mx-auto"></div>
              <p className="mt-4">Loading scan history...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    console.error("Scan history error:", error);
    return (
      <Card className="ios-card">
        <CardHeader className="bg-gray-50/70 dark:bg-gray-800/20 backdrop-blur-sm border-b border-gray-200/70 dark:border-gray-700/30">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            <CardTitle className="text-xl font-display">Scan History</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-red-500 dark:text-red-400">Error loading scan history. Please try again.</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="ios-card">
      <CardHeader className="bg-gray-50/70 dark:bg-gray-800/20 backdrop-blur-sm border-b border-gray-200/70 dark:border-gray-700/30">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-500" />
          <CardTitle className="text-xl font-display">Scan History</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {(!scans || scans.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <Package className="h-16 w-16 mb-6 opacity-40" />
            <p className="text-lg font-medium font-display">No Items</p>
            <p className="text-sm mt-1">Items you scan will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {scans.map((scan) => (
              <Card key={scan.id} className="ios-card border-gray-100 dark:border-gray-800 overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex justify-between items-start p-4">
                    <div>
                      <h3 className="font-medium text-base">{scan.product?.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{scan.product?.brand}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                        {new Date(scan.scanned_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-500">
                        {scan.product?.safety_score}
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {scan.product?.tags.map((tag, index) => (
                          <Badge 
                            key={index} 
                            variant="secondary" 
                            className="text-xs rounded-full px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
