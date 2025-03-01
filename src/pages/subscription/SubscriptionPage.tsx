
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ShieldCheck, CreditCard, CheckCircle, Clock, ChevronLeft } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';

const SubscriptionPage = () => {
  const { subscription, isLoading, checkoutSubscription, portalSession } = useSubscription();
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    // Handle success/cancel URL params from Stripe redirect
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    
    if (success) {
      toast({
        title: 'Subscription Activated',
        description: 'Thank you for subscribing to Scani Premium!',
      });
    } else if (canceled) {
      toast({
        title: 'Subscription Canceled',
        description: 'Your subscription process was canceled.',
      });
    }
    
    // Add Apple-like background gradient
    document.body.classList.add('bg-gradient-to-b', 'from-blue-50', 'to-white', 'dark:from-gray-900', 'dark:to-gray-800');
    return () => {
      document.body.classList.remove('bg-gradient-to-b', 'from-blue-50', 'to-white', 'dark:from-gray-900', 'dark:to-gray-800');
    };
  }, [searchParams, toast]);
  
  if (!session) {
    navigate('/auth');
    return null;
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="h-12 w-12 rounded-full border-2 border-t-transparent border-blue-500 animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }
  
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';
  const formattedDate = subscription?.current_period_end 
    ? new Date(subscription.current_period_end).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;
  
  return (
    <div className="min-h-screen p-4 animate-fade-in">
      <div className="max-w-md mx-auto pt-8 pb-16">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-8 pl-0 flex items-center text-gray-600 dark:text-gray-300 hover:bg-transparent hover:text-gray-900"
        >
          <ChevronLeft className="h-5 w-5 mr-1" />
          Back
        </Button>
        
        {isActive ? (
          <Card className="ios-card animate-scale-in border-green-100 dark:border-green-900">
            <CardHeader className="bg-green-50/80 dark:bg-green-900/20 backdrop-blur-sm border-b border-green-100 dark:border-green-800/30 pb-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-500" />
                <CardTitle className="text-xl font-display">Active Subscription</CardTitle>
              </div>
              <CardDescription className="mt-1 text-sm">
                Your Scani Premium subscription is active
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <div>
                    <p className="font-medium">Renewal Date</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {formattedDate || 'Not available'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <div>
                    <p className="font-medium">Subscription Status</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize mt-0.5">
                      {subscription?.status || 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-2 pb-5">
              <Button 
                variant="outline" 
                onClick={portalSession}
                className="w-full rounded-xl h-11 border-gray-200 dark:border-gray-700 font-medium"
              >
                Manage Subscription
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card className="ios-card animate-scale-in">
            <CardHeader className="bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-sm border-b border-blue-100 dark:border-blue-800/30 pb-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-blue-600 dark:text-blue-500" />
                <CardTitle className="text-xl font-display">Scani Premium</CardTitle>
              </div>
              <CardDescription className="mt-1 text-sm">
                Subscribe to unlock all premium features
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center mb-8">
                <span className="text-3xl font-bold font-display">$4.99</span>
                <span className="text-gray-500 dark:text-gray-400 ml-1">/ month</span>
              </div>
              
              <ul className="space-y-3 text-left">
                <li className="flex items-center gap-2.5">
                  <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
                  <span>Unlimited product scans</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
                  <span>Detailed product safety analysis</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
                  <span>Product comparison features</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
                  <span>Premium customer support</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter className="pt-2 pb-5">
              <Button 
                onClick={checkoutSubscription} 
                disabled={isLoading} 
                className="w-full bg-blue-500 hover:bg-blue-600 h-12 rounded-xl font-medium transition-colors"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {isLoading ? 'Processing...' : 'Subscribe Now'}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPage;
