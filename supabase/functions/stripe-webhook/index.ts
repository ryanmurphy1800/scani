
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.13.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

// We'll need to get the webhook secret from the environment
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    console.error('No Stripe signature found')
    return new Response(JSON.stringify({ error: 'No signature provided' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await req.text()
    let event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`)
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Event received: ${event.type}`)

    // Handle subscription events
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const customerId = session.customer
      const subscriptionId = session.subscription

      console.log('Checkout session completed:', { customerId, subscriptionId })

      if (customerId && subscriptionId) {
        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const userId = session.metadata?.user_id

        console.log('Subscription retrieved:', { 
          status: subscription.status, 
          currentPeriodEnd: subscription.current_period_end,
          userId
        })

        if (userId) {
          // Update subscription in database
          const { data, error } = await supabaseClient.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })

          if (error) {
            console.error('Error updating subscription in database:', error)
          } else {
            console.log('Subscription updated in database:', data)
          }
        }
      }
    } else if (event.type === 'customer.subscription.updated' || 
              event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object
      const subscriptionId = subscription.id
      const customerId = subscription.customer

      console.log(`Subscription ${event.type.split('.')[2]}:`, { 
        subscriptionId, 
        customerId, 
        status: subscription.status
      })

      // Find the user by subscription ID
      const { data, error } = await supabaseClient
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscriptionId)
        .single()

      if (error) {
        console.error('Error finding subscription in database:', error)
      } else if (data) {
        console.log('Found subscription in database:', data)
        
        // Update subscription status
        const { error: updateError } = await supabaseClient.from('subscriptions').upsert({
          user_id: data.user_id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: subscription.status,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        })

        if (updateError) {
          console.error('Error updating subscription status:', updateError)
        } else {
          console.log('Subscription status updated successfully')
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
