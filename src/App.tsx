import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { SubscriptionGuard } from "./components/SubscriptionGuard";
import { Footer } from "./components/ui/Footer";
import Index from "./pages/Index";
import AuthPage from "./pages/auth/AuthPage";
import SubscriptionPage from "./pages/subscription/SubscriptionPage";
import NotFound from "./pages/NotFound";
import { useAuth } from "./contexts/AuthContext";

const queryClient = new QueryClient();

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center">Loading...</div>
        <Footer />
      </div>
    );
  }
  
  if (!session) {
    return <Navigate to="/auth" />;
  }

  return <>{children}</>;
};

// Layout component to ensure footer appears on all pages
const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        {children}
      </div>
      <Footer />
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <BrowserRouter>
          <SubscriptionProvider>
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/auth" element={<Layout><AuthPage /></Layout>} />
              <Route
                path="/subscription"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SubscriptionPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <SubscriptionGuard>
                      <Layout>
                        <Index />
                      </Layout>
                    </SubscriptionGuard>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Layout><NotFound /></Layout>} />
            </Routes>
          </SubscriptionProvider>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
