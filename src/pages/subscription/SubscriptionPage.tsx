
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ShieldCheck, CreditCard, CheckCircle, Clock } from 'lucide-react';
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
  }, [searchParams, toast]);
  
  if (!session) {
    navigate('/auth');
    return null;
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading subscription details...</p>
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-3xl mx-auto py-8">
        <Button 
          variant="outline" 
          onClick={() => navigate('/')}
          className="mb-6"
        >
          Back to Home
        </Button>
        
        {isActive ? (
          <Card className="border-green-200 shadow-lg">
            <CardHeader className="bg-green-50 border-b border-green-100">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <CardTitle>Active Subscription</CardTitle>
              </div>
              <CardDescription>
                Your Scani Premium subscription is active
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="font-medium">Renewal Date</p>
                    <p className="text-sm text-gray-500">
                      {formattedDate || 'Not available'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="font-medium">Subscription Status</p>
                    <p className="text-sm text-gray-500 capitalize">
                      {subscription?.status || 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                onClick={portalSession}
                className="w-full"
              >
                Manage Subscription
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card className="shadow-lg">
            <CardHeader className="bg-blue-50 border-b border-blue-100">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-blue-600" />
                <CardTitle>Scani Premium</CardTitle>
              </div>
              <CardDescription>
                Subscribe to unlock all premium features
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center mb-6">
                <span className="text-3xl font-bold">$4.99</span>
                <span className="text-gray-500 ml-1">/ month</span>
              </div>
              
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Unlimited product scans</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Detailed product safety analysis</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Product comparison features</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Premium customer support</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={checkoutSubscription} 
                disabled={isLoading} 
                className="w-full"
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
