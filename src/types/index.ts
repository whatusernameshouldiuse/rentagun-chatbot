// Chat message types
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  sessionId?: string;
}

export interface ChatResponse {
  message: string;
  sessionId: string;
}

// Product types (from WordPress REST API)
export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  price: string;
  regular_price: string;
  images: ProductImage[];
  categories: ProductCategory[];
  available: boolean;
  fulfillment_source: 'rag' | 'sports_south';
  next_available_date: string | null;
  resources_available: number;
  meta_data: ProductMeta[];
}

export interface ProductImage {
  id: number;
  src: string;
  alt: string;
}

export interface ProductCategory {
  id: number;
  name: string;
  slug: string;
}

export interface ProductMeta {
  key: string;
  value: string;
}

// Availability types
export interface AvailabilityRequest {
  product_id: number;
  start_date: string;
  end_date: string;
}

export interface AvailabilityResponse {
  available: boolean;
  resources_available: number;
  fulfillment_source: 'rag' | 'sports_south';
  next_available_date: string | null;
}

// Order types
export interface OrderLookupRequest {
  order_number: string;
  email: string;
}

export interface Order {
  id: number;
  order_number: string;
  status: OrderStatus;
  date_created: string;
  customer_email: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
  };
  line_items: OrderLineItem[];
  shipping: {
    tracking_number: string | null;
    tracking_url: string | null;
    carrier: string | null;
  };
  ffl: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
  } | null;
  rental_dates: {
    start_date: string;
    end_date: string;
  };
}

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'at-ffl'
  | 'with-customer'
  | 'return-shipped'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export interface OrderLineItem {
  id: number;
  name: string;
  product_id: number;
  quantity: number;
  total: string;
}

// User interests (for Klaviyo segmentation)
export interface UserInterests {
  use_case: UseCase | null;
  categories: string[];
  products_viewed: string[];
  price_sensitivity: 'budget' | 'mid' | 'premium' | null;
  urgency: 'immediate' | 'this_week' | 'browsing' | null;
}

export type UseCase =
  | 'home_defense'
  | 'range_fun'
  | 'try_before_buy'
  | 'hunting'
  | 'first_gun';

// Email capture types
export interface SubscribeRequest {
  email: string;
  sessionId: string;
  source: 'chatbot';
  interests: UserInterests;
  conversation_summary?: string;
}

export interface SubscribeResponse {
  success: boolean;
  profile_id?: string;
  error?: string;
}

// API Error type
export interface ApiError {
  error: string;
  message: string;
  code?: string;
}

// Tool types for Claude
export interface ToolResult {
  type: 'product_list' | 'availability' | 'order' | 'error';
  data: unknown;
}
