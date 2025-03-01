
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from './AuthContext';
import type { Subscription } from '@/types/database';

type SubscriptionContextType = {
  subscription: Subscription | null;
  isLoading: boolean;
  error: Error | null;
  checkoutSubscription: () => Promise<void>;
  portalSession: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: React.ReactNode }) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session?.user) {
      setIsLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (error) throw error;
        
        // Type casting to ensure status matches the expected union type
        if (data) {
          const validStatus = data.status as Subscription['status'];
          setSubscription({
            ...data,
            status: validStatus,
          });
        } else {
          setSubscription(null);
        }
      } catch (err: any) {
        console.error('Error fetching subscription:', err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscription();

    // Subscribe to changes
    const subscriptionChannel = supabase
      .channel('subscription_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          // Type casting for the realtime updates as well
          const newData = payload.new as any;
          const validStatus = newData.status as Subscription['status'];
          setSubscription({
            ...newData,
            status: validStatus,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscriptionChannel);
    };
  }, [session]);

  const checkoutSubscription = async () => {
    if (!session?.user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to subscribe',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          price_id: 'price_1QxhihFSDRhP1UWw5Jxd42HI', // Updated to use the provided price ID
          success_url: window.location.origin + '/subscription?success=true',
          cancel_url: window.location.origin + '/subscription?canceled=true',
        },
      });

      if (error) throw error;

      window.location.href = data.url;
    } catch (err: any) {
      console.error('Error creating checkout session:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to start checkout process',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const portalSession = async () => {
    if (!session?.user || !subscription?.stripe_customer_id) {
      toast({
        title: 'Error',
        description: 'No active subscription found',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: {
          customer_id: subscription.stripe_customer_id,
          return_url: window.location.origin + '/subscription',
        },
      });

      if (error) throw error;

      window.location.href = data.url;
    } catch (err: any) {
      console.error('Error creating portal session:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to access subscription portal',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        isLoading,
        error,
        checkoutSubscription,
        portalSession,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
