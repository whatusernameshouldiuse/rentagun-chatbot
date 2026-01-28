/**
 * Claude Tools for Rentagun Chatbot
 * Defines tool schemas and handlers for product search, availability, and order lookup
 */

import type Anthropic from '@anthropic-ai/sdk';
import {
  getProducts,
  searchProducts,
  checkAvailability,
  lookupOrder,
  buildBookingUrl,
  WooCommerceError,
} from './woocommerce';
import { parseNaturalDate, DateParseResult } from './dates';
import type { Product, Order } from '@/types';

/**
 * Tool definitions for Claude
 */
export const tools: Anthropic.Tool[] = [
  {
    name: 'search_products',
    description:
      'Search for firearms in the Rentagun rental inventory. Use this when a customer asks about specific guns, categories, or wants to browse available rentals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description:
            'Search term (gun name, manufacturer, model). Examples: "Glock 19", "Desert Eagle", "9mm pistol"',
        },
        category: {
          type: 'string',
          enum: ['pistols', 'rifles', 'shotguns', 'handguns', 'revolvers'],
          description: 'Filter by firearm category',
        },
        available_only: {
          type: 'boolean',
          description:
            'Only show firearms that are currently available. Default true.',
        },
      },
    },
  },
  {
    name: 'check_availability',
    description:
      'Check if a specific firearm is available for rental on given dates. Use this when a customer asks about availability for specific dates.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_id: {
          type: 'number',
          description: 'The product ID to check',
        },
        product_name: {
          type: 'string',
          description:
            'Product name to search for if product_id is not known',
        },
        dates: {
          type: 'string',
          description:
            'Natural language date expression like "next week", "January 20-27", "tomorrow for 7 days"',
        },
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format (if not using natural language)',
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format (if not using natural language)',
        },
      },
      required: ['dates'],
    },
  },
  {
    name: 'lookup_order',
    description:
      'Look up a rental order status. Requires both order number AND email address for verification. Use when customer asks about their order, tracking, or shipment.',
    input_schema: {
      type: 'object' as const,
      properties: {
        order_number: {
          type: 'string',
          description: 'The order number (e.g., "5682", "RAG-5682")',
        },
        email: {
          type: 'string',
          description: 'Email address used for the order (for verification)',
        },
      },
      required: ['order_number', 'email'],
    },
  },
];

/**
 * Tool result types
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  display?: string;
}

/**
 * Handle tool calls from Claude
 */
export async function handleToolCall(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'search_products':
        return await handleProductSearch(toolInput);

      case 'check_availability':
        return await handleAvailabilityCheck(toolInput);

      case 'lookup_order':
        return await handleOrderLookup(toolInput);

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
        };
    }
  } catch (error) {
    if (error instanceof WooCommerceError) {
      return {
        success: false,
        error: getErrorMessage(error.code),
      };
    }

    console.error(`Tool ${toolName} error:`, error);
    return {
      success: false,
      error: 'Something went wrong. Please try again.',
    };
  }
}

/**
 * Handle product search
 */
async function handleProductSearch(
  input: Record<string, unknown>
): Promise<ToolResult> {
  const query = input.query as string | undefined;
  const category = input.category as string | undefined;
  const availableOnly = input.available_only !== false; // Default true

  let products: Product[];

  if (query) {
    products = await searchProducts(query);
  } else {
    const response = await getProducts({
      category,
      available_only: availableOnly,
      per_page: 10,
    });
    products = response.products;
  }

  // Filter by category if both query and category provided
  if (query && category) {
    products = products.filter((p) =>
      p.categories.some((c) => c.slug === category)
    );
  }

  // Filter by availability if requested
  if (availableOnly) {
    products = products.filter((p) => p.available);
  }

  // Limit results
  products = products.slice(0, 6);

  if (products.length === 0) {
    return {
      success: true,
      data: { products: [] },
      display: availableOnly
        ? "I couldn't find any available firearms matching that search. Would you like me to show all firearms, including those currently rented out?"
        : "I couldn't find any firearms matching that search. Try different keywords or browse by category.",
    };
  }

  return {
    success: true,
    data: {
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        daily_rate: calculateDailyRate(p),
        available: p.available,
        next_available_date: p.next_available_date,
        image: p.images[0]?.src || null,
        url: buildBookingUrl(p),
        categories: p.categories.map((c) => c.name),
      })),
      total: products.length,
    },
    display: formatProductResults(products),
  };
}

/**
 * Handle availability check
 */
async function handleAvailabilityCheck(
  input: Record<string, unknown>
): Promise<ToolResult> {
  // Parse dates
  let startDate: string;
  let endDate: string;

  if (input.dates) {
    const parsed = parseNaturalDate(input.dates as string);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error || "I couldn't understand those dates. Try something like 'next week' or 'January 20-27'.",
      };
    }
    startDate = parsed.startDate!;
    endDate = parsed.endDate!;
  } else if (input.start_date && input.end_date) {
    startDate = input.start_date as string;
    endDate = input.end_date as string;
  } else {
    return {
      success: false,
      error: 'Please specify the dates you want to rent.',
    };
  }

  // Get product
  let productId = input.product_id as number | undefined;
  let product: Product | null = null;

  if (!productId && input.product_name) {
    const products = await searchProducts(input.product_name as string);
    if (products.length > 0) {
      product = products[0];
      productId = product.id;
    }
  }

  if (!productId) {
    return {
      success: false,
      error: "I couldn't find that firearm. Could you tell me the specific name or search for it first?",
    };
  }

  // Check availability
  const availability = await checkAvailability({
    product_id: productId,
    start_date: startDate,
    end_date: endDate,
  });

  // Get product details if we don't have them
  if (!product) {
    const products = await searchProducts(productId.toString());
    product = products.find((p) => p.id === productId) || null;
  }

  return {
    success: true,
    data: {
      available: availability.available,
      product_id: productId,
      product_name: product?.name,
      start_date: startDate,
      end_date: endDate,
      next_available_date: availability.next_available_date,
      booking_url: product ? buildBookingUrl(product, startDate, endDate) : null,
    },
    display: formatAvailabilityResult(availability, product, startDate, endDate),
  };
}

/**
 * Handle order lookup
 */
async function handleOrderLookup(
  input: Record<string, unknown>
): Promise<ToolResult> {
  const orderNumber = input.order_number as string;
  const email = input.email as string;

  if (!orderNumber || !email) {
    return {
      success: false,
      error: 'I need both your order number and email address to look up your order.',
    };
  }

  // Clean order number (remove RAG- prefix if present)
  const cleanOrderNumber = orderNumber.replace(/^RAG-/i, '');

  const result = await lookupOrder({
    order_number: cleanOrderNumber,
    email,
  });

  return {
    success: true,
    data: result.order,
    display: formatOrderResult(result.order),
  };
}

/**
 * Calculate daily rental rate (2% of price)
 */
function calculateDailyRate(product: Product): number {
  const price = parseFloat(product.regular_price || product.price);
  return Math.round(price * 0.02 * 100) / 100;
}

/**
 * Format product search results for display
 */
function formatProductResults(products: Product[]): string {
  const lines = products.map((p, i) => {
    const dailyRate = calculateDailyRate(p);
    const availability = p.available
      ? '✅ Available now'
      : p.next_available_date
        ? `📅 Next available: ${p.next_available_date}`
        : '⏳ Check back soon';

    return `${i + 1}. **${p.name}** - $${dailyRate}/day
   ${availability}`;
  });

  return `Found ${products.length} firearms:\n\n${lines.join('\n\n')}`;
}

/**
 * Format availability result for display
 */
function formatAvailabilityResult(
  availability: { available: boolean; next_available_date: string | null },
  product: Product | null,
  startDate: string,
  endDate: string
): string {
  const productName = product?.name || 'This firearm';
  const dateRange = `${startDate} to ${endDate}`;

  if (availability.available) {
    return `✅ **${productName}** is available for ${dateRange}!\n\nReady to book? I can help you complete your reservation.`;
  }

  if (availability.next_available_date) {
    return `❌ **${productName}** is not available for ${dateRange}.\n\n📅 Next available: **${availability.next_available_date}**\n\nWould you like me to check those dates instead, or show you similar firearms that are available now?`;
  }

  return `❌ **${productName}** is not available for ${dateRange}.\n\nWould you like me to show you similar firearms that are available?`;
}

/**
 * Format order result for display
 */
function formatOrderResult(order: Order): string {
  const statusEmoji = getStatusEmoji(order.status);
  const items = order.line_items.map((item) => item.name).join(', ');

  let result = `${statusEmoji} **Order #${order.order_number}**

**Status:** ${order.status}
**Items:** ${items}
**Rental Dates:** ${order.rental_dates?.start_date || 'N/A'} to ${order.rental_dates?.end_date || 'N/A'}`;

  if (order.shipping?.tracking_number) {
    result += `\n\n📦 **Tracking:** [${order.shipping.tracking_number}](${order.shipping.tracking_url})`;
  }

  if (order.ffl) {
    result += `\n\n📍 **Pickup Location:**
${order.ffl.name}
${order.ffl.address}
${order.ffl.city}, ${order.ffl.state} ${order.ffl.zip}
📞 ${order.ffl.phone}`;
  }

  return result;
}

/**
 * Get emoji for order status
 */
function getStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    pending: '⏳',
    processing: '📋',
    shipped: '📦',
    'at-ffl': '🏪',
    'with-customer': '✅',
    'return-shipped': '↩️',
    completed: '✅',
    cancelled: '❌',
    refunded: '💰',
  };
  return emojis[status] || '📋';
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    product_not_found: "I couldn't find that firearm in our inventory.",
    order_not_found: "I couldn't find that order. Please check your order number and email.",
    invalid_date: "Those dates don't look right. Please try again.",
    rate_limit: "You've made too many requests. Please wait a moment and try again.",
    connection_error: "I'm having trouble connecting to our system. Please try again.",
    missing_api_key: "There's a configuration issue. Please contact support.",
  };
  return messages[code] || 'Something went wrong. Please try again.';
}
