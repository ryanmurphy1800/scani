
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';

export const SubscriptionGuard = ({ children }: { children: React.ReactNode }) => {
  const { subscription, isLoading } = useSubscription();
  const { session, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const isSubscriptionPage = location.pathname === '/subscription';
  const isAuthPage = location.pathname === '/auth';
  
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';
  
  useEffect(() => {
    if (!authLoading && !isLoading) {
      // If not authenticated, redirect to auth page
      if (!session && !isAuthPage) {
        navigate('/auth');
        return;
      }
      
      // If authenticated but no active subscription and not on exempted pages
      if (session && !isActive && !isSubscriptionPage && !isAuthPage) {
        navigate('/subscription');
      }
    }
  }, [session, subscription, isLoading, authLoading, navigate, isActive, isSubscriptionPage, isAuthPage]);
  
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
