/**
 * WordPress/WooCommerce API Client
 * Calls custom REST endpoints from rentagun-chatbot-api plugin
 */

import type {
  Product,
  AvailabilityRequest,
  AvailabilityResponse,
  OrderLookupRequest,
  Order,
} from '@/types';

// Configuration
const WORDPRESS_URL = process.env.WOOCOMMERCE_URL || 'https://rentagun.com';
const API_KEY = process.env.WORDPRESS_API_KEY || '';

// API Base URL
const API_BASE = `${WORDPRESS_URL}/wp-json/rentagun/v1`;

/**
 * Custom error for WooCommerce API errors
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
 * Make authenticated request to WordPress API
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!API_KEY) {
    throw new WooCommerceError(
      'WordPress API key not configured',
      'missing_api_key',
      500
    );
  }

  const url = `${API_BASE}${endpoint}`;

  try {
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
  } catch (error) {
    if (error instanceof WooCommerceError) {
      throw error;
    }

    throw new WooCommerceError(
      'Failed to connect to WordPress API',
      'connection_error',
      503
    );
  }
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
 */
export async function getProducts(
  params: ProductSearchParams = {}
): Promise<ProductListResponse> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set('page', params.page.toString());
  if (params.per_page) searchParams.set('per_page', params.per_page.toString());
  if (params.category) searchParams.set('category', params.category);
  if (params.search) searchParams.set('search', params.search);
  if (params.available_only !== undefined) {
    searchParams.set('available_only', params.available_only.toString());
  }

  const query = searchParams.toString();
  const endpoint = `/products${query ? `?${query}` : ''}`;

  return apiRequest<ProductListResponse>(endpoint);
}

/**
 * Get a single product by ID
 */
export async function getProduct(productId: number): Promise<Product | null> {
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
 */
export async function checkAvailability(
  request: AvailabilityRequest
): Promise<AvailabilityResponse> {
  return apiRequest<AvailabilityResponse>('/availability', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Look up order by number and email
 */
export async function lookupOrder(
  request: OrderLookupRequest
): Promise<{ order: Order }> {
  return apiRequest<{ order: Order }>('/orders/lookup', {
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
    ? '✓ Available'
    : product.next_available_date
      ? `Next available: ${product.next_available_date}`
      : 'Currently unavailable';

  return `**${product.name}** - $${product.price}/day
${availability}
[View Details](${product.images[0]?.src || '#'})`;
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
