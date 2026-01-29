/**
 * WordPress/WooCommerce API Client
 * Supports BOTH:
 * - Custom Rentagun API (preferred, requires WordPress plugin)
 * - Standard WooCommerce REST API (fallback, works immediately)
 */

import type {
  Product,
  AvailabilityRequest,
  AvailabilityResponse,
  OrderLookupRequest,
  Order,
} from '@/types';

// Configuration - ensure URL has https:// prefix
const rawUrl = process.env.WOOCOMMERCE_URL || 'https://rentagun.com';
const WORDPRESS_URL = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

// Custom Rentagun API credentials
const API_KEY = process.env.WORDPRESS_API_KEY || '';

// Standard WooCommerce API credentials (fallback)
const CONSUMER_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY || '';
const CONSUMER_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET || '';

// Determine which API to use
const USE_CUSTOM_API = !!API_KEY;
const USE_WOOCOMMERCE_API = !!(CONSUMER_KEY && CONSUMER_SECRET);

// API Base URLs
const CUSTOM_API_BASE = `${WORDPRESS_URL}/wp-json/rentagun/v1`;
const WC_API_BASE = `${WORDPRESS_URL}/wp-json/wc/v3`;

// Log config status (not secrets)
console.log('[Rentagun API] Config:', {
  url: WORDPRESS_URL,
  mode: USE_CUSTOM_API ? 'custom-api' : USE_WOOCOMMERCE_API ? 'woocommerce' : 'none',
  hasApiKey: !!API_KEY,
  hasWooCredentials: USE_WOOCOMMERCE_API,
});

/**
 * Custom error for API errors
 */
export class WooCommerceError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number = 500) {
    super(message);
    this.name = 'WooCommerceError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Make authenticated request to Custom Rentagun API
 */
async function customApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${CUSTOM_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new WooCommerceError(
      errorData.message || `API request failed: ${response.status}`,
      errorData.code || 'api_error',
      response.status
    );
  }

  return response.json();
}

/**
 * Make authenticated request to Standard WooCommerce API
 */
async function wooCommerceApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = new URL(`${WC_API_BASE}${endpoint}`);
  url.searchParams.set('consumer_key', CONSUMER_KEY);
  url.searchParams.set('consumer_secret', CONSUMER_SECRET);

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new WooCommerceError(
      errorData.message || `WooCommerce API request failed: ${response.status}`,
      errorData.code || 'api_error',
      response.status
    );
  }

  return response.json();
}

// WooCommerce product type (standard API response)
interface WCProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  price: string;
  regular_price: string;
  description: string;
  short_description: string;
  categories: { id: number; name: string; slug: string }[];
  images: { id: number; src: string; alt: string }[];
  stock_status: string;
  meta_data?: { key: string; value: string }[];
}

/**
 * Transform WooCommerce product to our Product type
 * Note: WooCommerce 'price' field IS the daily rental rate, not MSRP
 */
function transformWCProduct(wc: WCProduct): Product {
  // The price field in WooCommerce is already the daily rental rate
  const dailyRate = wc.price || wc.regular_price || '0';

  return {
    id: wc.id,
    name: wc.name,
    slug: wc.slug,
    description: wc.description || '',
    short_description: wc.short_description || '',
    price: dailyRate,
    regular_price: wc.regular_price || wc.price || '0',
    images: wc.images || [],
    categories: wc.categories || [],
    available: wc.stock_status === 'instock',
    fulfillment_source: 'rag', // Default for WooCommerce products
    next_available_date: null,
    resources_available: wc.stock_status === 'instock' ? 1 : 0,
    meta_data: wc.meta_data || [],
  };
}

/**
 * Product search parameters
 */
export interface ProductSearchParams {
  page?: number;
  per_page?: number;
  category?: string;
  search?: string;
  available_only?: boolean;
}

/**
 * Product list response
 */
export interface ProductListResponse {
  products: Product[];
  total: number;
  pages: number;
  page: number;
  per_page: number;
}

/**
 * Get products with optional filters
 * Uses custom API if available, falls back to WooCommerce API
 */
export async function getProducts(
  params: ProductSearchParams = {}
): Promise<ProductListResponse> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set('page', params.page.toString());
  if (params.per_page) searchParams.set('per_page', params.per_page.toString());
  if (params.search) searchParams.set('search', params.search);

  if (USE_CUSTOM_API) {
    // Custom Rentagun API
    if (params.category) searchParams.set('category', params.category);
    if (params.available_only !== undefined) {
      searchParams.set('available_only', params.available_only.toString());
    }

    const query = searchParams.toString();
    const endpoint = `/products${query ? `?${query}` : ''}`;

    return customApiRequest<ProductListResponse>(endpoint);
  } else if (USE_WOOCOMMERCE_API) {
    // Standard WooCommerce API
    searchParams.set('status', 'publish');
    searchParams.set('per_page', (params.per_page || 10).toString());

    const query = searchParams.toString();
    const endpoint = `/products${query ? `?${query}` : ''}`;

    console.log('[Rentagun API] WooCommerce request:', endpoint);
    const wcProducts = await wooCommerceApiRequest<WCProduct[]>(endpoint);
    let products = wcProducts.map(transformWCProduct);

    // Client-side category filter for WooCommerce
    if (params.category) {
      const categoryLower = params.category.toLowerCase();
      products = products.filter(p =>
        p.categories?.some(c =>
          c.name.toLowerCase().includes(categoryLower) ||
          c.slug.toLowerCase().includes(categoryLower)
        )
      );
    }

    return {
      products,
      total: products.length,
      pages: 1,
      page: params.page || 1,
      per_page: params.per_page || 10,
    };
  } else {
    throw new WooCommerceError(
      'No API credentials configured. Set WORDPRESS_API_KEY or WOOCOMMERCE_CONSUMER_KEY/SECRET.',
      'config_error',
      500
    );
  }
}

/**
 * Get a single product by ID
 */
export async function getProduct(productId: number): Promise<Product | null> {
  if (USE_WOOCOMMERCE_API && !USE_CUSTOM_API) {
    // Direct product lookup via WooCommerce
    try {
      const wcProduct = await wooCommerceApiRequest<WCProduct>(`/products/${productId}`);
      return transformWCProduct(wcProduct);
    } catch {
      return null;
    }
  }

  // Fallback to search
  const response = await getProducts({ search: productId.toString() });
  return response.products.find((p) => p.id === productId) || null;
}

/**
 * Search products by name/query
 */
export async function searchProducts(query: string): Promise<Product[]> {
  const response = await getProducts({
    search: query,
    per_page: 10,
    available_only: false,
  });

  return response.products;
}

/**
 * Check availability for specific dates
 * Note: Only works with custom API; WooCommerce doesn't have this endpoint
 */
export async function checkAvailability(
  request: AvailabilityRequest
): Promise<AvailabilityResponse> {
  if (!USE_CUSTOM_API) {
    // Return mock response for WooCommerce mode (assume available)
    return {
      available: true,
      resources_available: 1,
      fulfillment_source: 'rag',
      next_available_date: null,
    };
  }

  return customApiRequest<AvailabilityResponse>('/availability', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Look up order by number and email
 * Note: Only works with custom API
 */
export async function lookupOrder(
  request: OrderLookupRequest
): Promise<{ order: Order }> {
  if (!USE_CUSTOM_API) {
    throw new WooCommerceError(
      'Order lookup requires the WordPress plugin to be installed',
      'plugin_required',
      501
    );
  }

  return customApiRequest<{ order: Order }>('/orders/lookup', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Category slugs for filtering
 */
export const PRODUCT_CATEGORIES = {
  PISTOLS: 'pistols',
  RIFLES: 'rifles',
  SHOTGUNS: 'shotguns',
  HANDGUNS: 'handguns',
  REVOLVERS: 'revolvers',
} as const;

/**
 * Format product for display
 */
export function formatProductForDisplay(product: Product): string {
  const availability = product.available
    ? 'Available'
    : product.next_available_date
      ? `Next available: ${product.next_available_date}`
      : 'Currently unavailable';

  const imageUrl = product.images?.[0]?.src || '#';

  return `**${product.name}** - $${product.price}/day
${availability}
[View Details](${imageUrl})`;
}

/**
 * Build booking URL with dates pre-filled
 */
export function buildBookingUrl(
  product: Product,
  startDate?: string,
  endDate?: string
): string {
  let url = `${WORDPRESS_URL}/product/${product.slug}/`;

  const params = new URLSearchParams();
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);

  const query = params.toString();
  return query ? `${url}?${query}` : url;
}
