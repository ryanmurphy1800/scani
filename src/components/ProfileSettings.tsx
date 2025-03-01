
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { UserCircle2 } from "lucide-react";

export const ProfileSettings = () => {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { session } = useAuth();

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          username,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Username updated successfully",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="ios-card max-w-md mx-auto animate-scale-in">
      <CardHeader className="bg-gray-50/70 dark:bg-gray-800/20 backdrop-blur-sm border-b border-gray-200/70 dark:border-gray-700/30">
        <div className="flex items-center gap-3">
          <UserCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-500" />
          <CardTitle className="text-xl font-display">Profile Settings</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleUpdateUsername} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium block">
              Username
            </label>
            <Input
              id="username"
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="ios-input"
            />
          </div>
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full rounded-xl h-11 bg-blue-500 hover:bg-blue-600 transition-colors"
          >
            {isLoading ? "Updating..." : "Update Username"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
