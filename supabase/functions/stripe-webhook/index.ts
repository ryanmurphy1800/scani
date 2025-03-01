
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.13.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response(JSON.stringify({ error: 'No signature provided' }), {
      status: 400,
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
      })
    }

    console.log(`Event received: ${event.type}`)

    // Handle subscription events
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const customerId = session.customer
      const subscriptionId = session.subscription

      if (customerId && subscriptionId) {
        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const userId = session.metadata?.user_id

        if (userId) {
          // Update subscription in database
          await supabaseClient.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
        }
      }
    } else if (event.type === 'customer.subscription.updated' || 
              event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object
      const subscriptionId = subscription.id
      const customerId = subscription.customer

      // Find the user by customer ID
      const { data } = await supabaseClient
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscriptionId)
        .single()

      if (data) {
        // Update subscription status
        await supabaseClient.from('subscriptions').upsert({
          user_id: data.user_id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: subscription.status,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        })
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
    })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    })
  }
})
