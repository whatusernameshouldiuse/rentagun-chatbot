/**
 * Orders API Endpoint
 * POST /api/orders - Look up order by number and email
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { lookupOrder, WooCommerceError } from '@/lib/woocommerce';

// CORS headers for widget access
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || 'https://rentagun.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { order_number, email } = body;

    // Validate required fields
    if (!order_number || !email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          message: 'Both order number and email are required.',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email',
          message: 'Please provide a valid email address.',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Sanitize order number (remove RAG- prefix if present)
    const cleanOrderNumber = String(order_number).replace(/^RAG-/i, '').trim();

    // Look up order
    const result = await lookupOrder({
      order_number: cleanOrderNumber,
      email: email.trim().toLowerCase(),
    });

    return NextResponse.json(
      {
        success: true,
        order: result.order,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Orders API] Error:', error);

    // Handle WooCommerce errors
    if (error instanceof WooCommerceError) {
      const status = error.status === 404 ? 404 : 500;
      return NextResponse.json(
        {
          success: false,
          error: error.code,
          // Always return generic message for security (don't reveal if email is wrong)
          message: 'Order not found. Please check your order number and email address.',
        },
        { status, headers: corsHeaders }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        success: false,
        error: 'server_error',
        message: 'Something went wrong. Please try again.',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
