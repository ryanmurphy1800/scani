
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import type { Scan } from "@/types/database";

export const ScanHistory = () => {
  const { session } = useAuth();

  const { data: scans, isLoading } = useQuery({
    queryKey: ["scans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scans")
        .select(`
          *,
          product:products(*)
        `)
        .eq("user_id", session?.user?.id)
        .order("scanned_at", { ascending: false });

      if (error) throw error;
      return data as (Scan)[];
    },
    enabled: !!session?.user?.id,
  });

  if (isLoading) {
    return <div>Loading scan history...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scan History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {scans?.map((scan) => (
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
      </CardContent>
    </Card>
  );
};
