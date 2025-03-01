
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';

// Define routes that require subscription
const SUBSCRIPTION_REQUIRED_ROUTES: string[] = [
  // Add paths that require subscription here
  // For example: '/premium-feature', '/reports', etc.
  // Leave this empty for now to allow access to all routes
];

export const SubscriptionGuard = ({ children }: { children: React.ReactNode }) => {
  const { subscription, isLoading } = useSubscription();
  const { session, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const isSubscriptionPage = location.pathname === '/subscription';
  const isAuthPage = location.pathname === '/auth';
  
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';
  const requiresSubscription = SUBSCRIPTION_REQUIRED_ROUTES.some(route => 
    location.pathname === route || location.pathname.startsWith(`${route}/`)
  );
  
  useEffect(() => {
    if (!authLoading && !isLoading) {
      // If not authenticated, redirect to auth page
      if (!session && !isAuthPage) {
        navigate('/auth');
        return;
      }
      
      // Only redirect to subscription page if the current route requires subscription
      if (session && !isActive && requiresSubscription && !isSubscriptionPage && !isAuthPage) {
        navigate('/subscription');
      }
    }
  }, [
    session, 
    subscription, 
    isLoading, 
    authLoading, 
    navigate, 
    isActive, 
    isSubscriptionPage, 
    isAuthPage, 
    requiresSubscription,
    location.pathname
  ]);
  
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
};
