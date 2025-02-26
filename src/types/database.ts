
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
