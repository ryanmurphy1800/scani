
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import type { Scan } from "@/types/database";
import { Package } from "lucide-react";

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
      <Card>
        <CardHeader>
          <CardTitle>Scan History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading scan history...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    console.error("Scan history error:", error);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scan History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-red-500">Error loading scan history. Please try again.</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scan History</CardTitle>
      </CardHeader>
      <CardContent>
        {(!scans || scans.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Package className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No scans yet</p>
            <p className="text-sm">Your scanned products will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {scans.map((scan) => (
              <Card key={scan.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{scan.product?.name}</h3>
                      <p className="text-sm text-gray-500">{scan.product?.brand}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(scan.scanned_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-2xl font-bold text-blue-600">
                        {scan.product?.safety_score}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {scan.product?.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
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
