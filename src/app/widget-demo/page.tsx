'use client';

import { useEffect, useState } from 'react';

interface Product {
  id: number;
  name: string;
  slug: string;
  price: string;
  images: { src: string; alt: string }[];
}

export default function WidgetDemo() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set API URL for local development
    (window as Window & { RENTAGUN_CHAT_API?: string }).RENTAGUN_CHAT_API =
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000'
        : 'https://rentagun-chatbot.vercel.app';

    // Load widget script
    const script = document.createElement('script');
    script.src = '/widget.js';
    script.async = true;
    document.body.appendChild(script);

    // Fetch real products
    fetch('/api/products?per_page=6')
      .then(res => res.json())
      .then(data => {
        setProducts(data.products || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return () => {
      script.remove();
      const widget = document.querySelector('.rag-widget');
      if (widget) widget.remove();
    };
  }, []);

  const openChat = () => {
    const btn = document.querySelector('.rag-chat-toggle') as HTMLButtonElement;
    if (btn) btn.click();
  };

  return (
    <main style={{
      minHeight: '100vh',
      background: '#1a1a1a',
      fontFamily: "'Open Sans', sans-serif"
    }}>
      {/* Header with Logo */}
      <header style={{
        background: '#CC0000',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <a href="https://rentagun.com" style={{ textDecoration: 'none' }}>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: 'white',
              fontFamily: "'Oswald', sans-serif",
              letterSpacing: '2px',
              margin: 0
            }}>
              RENTAGUN
            </h1>
          </a>
          <nav style={{ display: 'flex', gap: '24px', fontSize: '14px' }}>
            <a href="https://rentagun.com/shop" style={{ color: 'white', textDecoration: 'none', opacity: 0.9 }}>Browse</a>
            <a href="https://rentagun.com/how-it-works" style={{ color: 'white', textDecoration: 'none', opacity: 0.9 }}>How It Works</a>
            <a href="https://rentagun.com/pricing" style={{ color: 'white', textDecoration: 'none', opacity: 0.9 }}>Pricing</a>
          </nav>
        </div>
      </header>

      {/* Hero with Chat CTA */}
      <section style={{
        background: 'linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 100%)',
        padding: '60px 24px',
        textAlign: 'center',
        borderBottom: '1px solid #333'
      }}>
        <h2 style={{
          fontSize: '48px',
          fontWeight: '700',
          color: 'white',
          fontFamily: "'Oswald', sans-serif",
          marginBottom: '16px',
          letterSpacing: '1px'
        }}>
          Find Your Perfect Rental
        </h2>
        <p style={{
          fontSize: '18px',
          color: '#999',
          maxWidth: '600px',
          margin: '0 auto 32px',
          lineHeight: '1.6'
        }}>
          200+ firearms available. Ships to your FFL in 48 states.
          Need help deciding? Our Range Guide can match you with the right firearm.
        </p>

        {/* Primary CTA - Chat */}
        <button
          onClick={openChat}
          style={{
            background: '#CC0000',
            color: 'white',
            border: 'none',
            padding: '16px 40px',
            fontSize: '18px',
            fontWeight: '600',
            fontFamily: "'Oswald', sans-serif",
            borderRadius: '4px',
            cursor: 'pointer',
            letterSpacing: '1px',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => (e.target as HTMLButtonElement).style.background = '#a01818'}
          onMouseOut={(e) => (e.target as HTMLButtonElement).style.background = '#CC0000'}
        >
          TALK TO RANGE GUIDE
        </button>
        <p style={{ color: '#666', fontSize: '14px', marginTop: '12px' }}>
          Get personalized recommendations in seconds
        </p>
      </section>

      {/* Product Grid with Real Images */}
      <section style={{ padding: '48px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <h3 style={{
          fontSize: '28px',
          fontWeight: '600',
          marginBottom: '32px',
          color: 'white',
          fontFamily: "'Oswald', sans-serif",
          letterSpacing: '1px'
        }}>
          POPULAR RENTALS
        </h3>

        {loading ? (
          <p style={{ color: '#666', textAlign: 'center' }}>Loading inventory...</p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '24px'
          }}>
            {products.map((product) => (
              <div key={product.id} style={{
                background: '#2a2a2a',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #333',
                transition: 'transform 0.2s, border-color 0.2s'
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                (e.currentTarget as HTMLDivElement).style.borderColor = '#CC0000';
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.borderColor = '#333';
              }}
              >
                {/* Product Image */}
                <div style={{
                  background: '#1a1a1a',
                  height: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  {product.images?.[0]?.src ? (
                    <img
                      src={product.images[0].src}
                      alt={product.name}
                      style={{
                        maxWidth: '90%',
                        maxHeight: '180px',
                        objectFit: 'contain'
                      }}
                    />
                  ) : (
                    <div style={{ color: '#444', fontSize: '14px' }}>No image</div>
                  )}
                </div>

                {/* Product Info */}
                <div style={{ padding: '20px' }}>
                  <h4 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: 'white',
                    lineHeight: '1.4',
                    height: '44px',
                    overflow: 'hidden'
                  }}>
                    {product.name.length > 50
                      ? product.name.substring(0, 50) + '...'
                      : product.name}
                  </h4>
                  <p style={{ color: '#CC0000', fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                    ${product.price}/day
                  </p>
                  <a
                    href={`https://rentagun.com/product/${product.slug}/`}
                    style={{
                      display: 'block',
                      width: '100%',
                      background: 'transparent',
                      color: 'white',
                      border: '1px solid #CC0000',
                      padding: '12px',
                      borderRadius: '4px',
                      textAlign: 'center',
                      textDecoration: 'none',
                      fontWeight: '500',
                      fontSize: '14px',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => (e.target as HTMLAnchorElement).style.background = '#CC0000'}
                    onMouseOut={(e) => (e.target as HTMLAnchorElement).style.background = 'transparent'}
                  >
                    View Details
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Help Section - Secondary Chat CTA */}
      <section style={{
        background: '#2a2a2a',
        padding: '48px 24px',
        textAlign: 'center',
        borderTop: '1px solid #333'
      }}>
        <h3 style={{
          fontSize: '24px',
          fontWeight: '600',
          marginBottom: '16px',
          color: 'white',
          fontFamily: "'Oswald', sans-serif"
        }}>
          NOT SURE WHAT TO RENT?
        </h3>
        <p style={{ color: '#999', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px' }}>
          Tell our Range Guide what you&apos;re looking for. Home defense, range day, hunting trip,
          or just want to experience something iconic - we&apos;ll match you with the right firearm.
        </p>
        <button
          onClick={openChat}
          style={{
            background: 'transparent',
            color: '#CC0000',
            border: '2px solid #CC0000',
            padding: '14px 32px',
            fontSize: '16px',
            fontWeight: '600',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            (e.target as HTMLButtonElement).style.background = '#CC0000';
            (e.target as HTMLButtonElement).style.color = 'white';
          }}
          onMouseOut={(e) => {
            (e.target as HTMLButtonElement).style.background = 'transparent';
            (e.target as HTMLButtonElement).style.color = '#CC0000';
          }}
        >
          Get Recommendations
        </button>
      </section>

      {/* Footer */}
      <footer style={{
        background: '#111',
        color: 'white',
        padding: '32px 24px',
        textAlign: 'center',
        borderTop: '1px solid #333'
      }}>
        <p style={{ color: '#666', fontSize: '14px' }}>
          &copy; 2026 Rentagun. Ships to 48 states via FFL.
        </p>
      </footer>

      {/* Load widget CSS and fonts */}
      <link rel="stylesheet" href="/widget.css" />
      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Open+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
    </main>
  );
}
