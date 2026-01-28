import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      chat: 'ready',
      products: 'ready',
      availability: 'pending',
      orders: 'pending',
    },
  });
}
