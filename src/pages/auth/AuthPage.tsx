
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const AuthPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    document.body.classList.add('bg-gradient-to-b', 'from-blue-50', 'to-white', 'dark:from-gray-900', 'dark:to-gray-800');
    return () => {
      document.body.classList.remove('bg-gradient-to-b', 'from-blue-50', 'to-white', 'dark:from-gray-900', 'dark:to-gray-800');
    };
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast({
          title: "Success!",
          description: "Please check your email to verify your account.",
        });
      }
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
    <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-md glassmorphism border-none shadow-lg">
        <CardHeader className="space-y-1 pt-8">
          <CardTitle className="text-2xl font-display text-center">
            {isLogin ? "Sign in to Scani" : "Create a Scani account"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-1">
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="ios-input focus:ring-2 focus:ring-blue-400 transition-all duration-200"
              />
            </div>
            <div className="space-y-1">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="ios-input focus:ring-2 focus:ring-blue-400 transition-all duration-200"
              />
            </div>
            <div>
              <Button
                type="submit"
                className="w-full h-12 bg-blue-500 hover:bg-blue-600 font-medium rounded-xl transition-colors"
                disabled={isLoading}
              >
                {isLoading
                  ? "Loading..."
                  : isLogin
                  ? "Sign In"
                  : "Sign Up"}
              </Button>
            </div>
          </form>
          <div className="mt-6 text-center">
            <Button
              variant="link"
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-500 hover:text-blue-600 font-medium"
            >
              {isLogin
                ? "Need an account? Sign up"
                : "Already have an account? Sign in"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
