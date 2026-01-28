import { NextRequest, NextResponse } from 'next/server';
import { getProducts, ProductSearchParams, WooCommerceError } from '@/lib/woocommerce';
import { errorResponse, logError } from '@/lib/errors';

export const runtime = 'nodejs';

// Cache products for 1 hour
export const revalidate = 3600;

/**
 * GET /api/products
 * Proxy to WordPress API with caching
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params: ProductSearchParams = {
      page: searchParams.get('page')
        ? parseInt(searchParams.get('page')!, 10)
        : undefined,
      per_page: searchParams.get('per_page')
        ? parseInt(searchParams.get('per_page')!, 10)
        : undefined,
      category: searchParams.get('category') || undefined,
      search: searchParams.get('search') || undefined,
      available_only: searchParams.get('available_only') === 'true',
    };

    const result = await getProducts(params);

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    logError('products_endpoint', error);

    if (error instanceof WooCommerceError) {
      return errorResponse(error.code, error.status);
    }

    return errorResponse('unknown', 500);
  }
}

/**
 * OPTIONS /api/products
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
