
export interface Profile {
  id: string;
  username: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  barcode: string;
  safety_score: number;
  tags: string[];
  created_at: string;
}

export interface Scan {
  id: string;
  user_id: string;
  product_id: string;
  scanned_at: string;
  product?: Product;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'trialing' | 'unpaid';
  current_period_end: string;
  created_at: string;
  updated_at: string;
}
