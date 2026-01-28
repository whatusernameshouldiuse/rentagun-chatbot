# Rentagun Concierge Chatbot

AI-powered chat assistant for rentagun.com - the first national try-before-you-buy firearm rental service.

## Features

- **FAQ Answering**: Responds to common questions about how renting works, pricing, FFL process, shipping, and state restrictions
- **Product Search**: Search and browse available firearms (Sprint 2)
- **Availability Checking**: Check if specific firearms are available for dates (Sprint 3)
- **Order Tracking**: Look up order status with email verification (Sprint 4)
- **Email Capture**: Collect emails with Klaviyo integration for follow-up (Sprint 6)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **AI**: Anthropic Claude API with streaming
- **Deployment**: Vercel
- **Widget**: Vanilla JS embeddable script

## Project Structure

```
rentagun-chatbot/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts       # Main chat endpoint
│   │   │   ├── health/route.ts     # Health check
│   │   │   ├── products/route.ts   # Product search (Sprint 2)
│   │   │   ├── orders/route.ts     # Order lookup (Sprint 4)
│   │   │   └── subscribe/route.ts  # Email capture (Sprint 6)
│   │   ├── widget-demo/page.tsx    # Widget test page
│   │   └── page.tsx                # Landing page
│   ├── lib/
│   │   ├── anthropic.ts            # Claude API client
│   │   ├── prompts.ts              # System prompt builder
│   │   ├── knowledge.ts            # Knowledge base loader
│   │   ├── sanitize.ts             # Input sanitization
│   │   └── errors.ts               # Error handling
│   ├── knowledge/
│   │   ├── faq.md                  # General FAQ
│   │   ├── pricing.md              # Pricing info
│   │   ├── ffl-process.md          # FFL/pickup process
│   │   ├── shipping.md             # Shipping details
│   │   ├── state-restrictions.md   # State restrictions
│   │   └── brand-voice.md          # Brand guidelines
│   └── types/
│       └── index.ts                # TypeScript types
├── public/
│   ├── widget.js                   # Embeddable chat widget
│   └── widget.css                  # Widget styles
├── middleware.ts                   # Rate limiting
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- Anthropic API key
- (Optional) WooCommerce credentials for product/order features

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local

# Edit .env.local with your API keys
```

### Development

```bash
npm run dev
```

Visit http://localhost:3000/widget-demo to test the chat widget.

### Testing

```bash
npm test
```

### Deployment

Deploy to Vercel:

```bash
vercel deploy
```

Set environment variables in Vercel dashboard.

## Widget Integration

Add to any website:

```html
<script>
  window.RENTAGUN_CHAT_API = 'https://your-deployment.vercel.app';
</script>
<script src="https://your-deployment.vercel.app/widget.js" async></script>
```

## API Endpoints

### POST /api/chat

Main chat endpoint with streaming response.

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "How does renting work?" }
  ],
  "sessionId": "optional-session-id"
}
```

**Response:** Server-Sent Events stream

### GET /api/health

Health check endpoint.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Anthropic API key | Yes |
| `WOOCOMMERCE_URL` | WooCommerce site URL | Sprint 2+ |
| `WOOCOMMERCE_CONSUMER_KEY` | WooCommerce key | Sprint 2+ |
| `WOOCOMMERCE_CONSUMER_SECRET` | WooCommerce secret | Sprint 2+ |
| `WORDPRESS_API_KEY` | WordPress REST API key | Sprint 2+ |
| `KLAVIYO_API_KEY` | Klaviyo API key | Sprint 6 |
| `ALLOWED_ORIGINS` | CORS allowed origins | Production |

## Sprint Status

- [x] Sprint 1: Foundation & Basic Chat
- [ ] Sprint 1.5: WordPress REST API Endpoints
- [ ] Sprint 2: WooCommerce Product Integration
- [ ] Sprint 3: Availability & Booking
- [ ] Sprint 4: Order Tracking
- [ ] Sprint 5: Polish & Production
- [ ] Sprint 6: Klaviyo Integration

## License

Proprietary - Rentagun LLC
