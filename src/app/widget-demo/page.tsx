'use client';

import { useEffect } from 'react';

export default function WidgetDemo() {
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

    return () => {
      // Cleanup on unmount
      script.remove();
      const widget = document.querySelector('.rag-widget');
      if (widget) widget.remove();
    };
  }, []);

  return (
    <main style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Mock product page header */}
      <header style={{
        background: '#c41e3a',
        color: 'white',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px'
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Rentagun</h1>
        <nav style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
          <a href="#" style={{ color: 'white', textDecoration: 'none' }}>Firearms</a>
          <a href="#" style={{ color: 'white', textDecoration: 'none' }}>How It Works</a>
          <a href="#" style={{ color: 'white', textDecoration: 'none' }}>Pricing</a>
          <a href="#" style={{ color: 'white', textDecoration: 'none' }}>FAQ</a>
        </nav>
      </header>

      {/* Hero section */}
      <section style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
        color: 'white',
        padding: '60px 24px',
        textAlign: 'center'
      }}>
        <h2 style={{ fontSize: '42px', fontWeight: 'bold', marginBottom: '16px' }}>
          Try Before You Buy
        </h2>
        <p style={{ fontSize: '18px', opacity: 0.9, maxWidth: '600px', margin: '0 auto 32px' }}>
          The first national firearm rental service. Rent it Saturday, decide Sunday.
        </p>
        <button style={{
          background: '#c41e3a',
          color: 'white',
          border: 'none',
          padding: '14px 28px',
          fontSize: '16px',
          fontWeight: '600',
          borderRadius: '8px',
          cursor: 'pointer'
        }}>
          Browse Firearms
        </button>
      </section>

      {/* Mock product grid */}
      <section style={{ padding: '48px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px' }}>
          Popular Rentals
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '24px'
        }}>
          {[
            { name: 'Glock 19 Gen 5', price: 11, image: '🔫' },
            { name: 'Desert Eagle .50 AE', price: 38, image: '🔫' },
            { name: 'Colt Python', price: 30, image: '🔫' },
            { name: 'S&W Model 500', price: 35, image: '🔫' },
            { name: 'HK MP5 .22LR', price: 10, image: '🔫' },
            { name: 'Steyr AUG', price: 45, image: '🔫' },
          ].map((product, i) => (
            <div key={i} style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              <div style={{
                background: '#f0f0f0',
                borderRadius: '8px',
                height: '160px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px',
                marginBottom: '16px'
              }}>
                {product.image}
              </div>
              <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                {product.name}
              </h4>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px' }}>
                ${product.price}/day
              </p>
              <button style={{
                width: '100%',
                background: '#c41e3a',
                color: 'white',
                border: 'none',
                padding: '10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}>
                View Details
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Info box about the demo */}
      <section style={{
        background: '#fff3cd',
        border: '1px solid #ffc107',
        borderRadius: '8px',
        padding: '16px 24px',
        margin: '24px',
        maxWidth: '800px',
        marginLeft: 'auto',
        marginRight: 'auto'
      }}>
        <h4 style={{ fontWeight: '600', marginBottom: '8px', color: '#856404' }}>
          Widget Demo
        </h4>
        <p style={{ color: '#856404', fontSize: '14px' }}>
          This is a demo page showing the Rentagun chat widget. Look for the chat bubble in the bottom-right corner.
          The widget will appear with a teaser message after 45 seconds of inactivity.
          Try asking questions like &quot;How does renting work?&quot; or &quot;What states can you ship to?&quot;
        </p>
      </section>

      {/* Footer */}
      <footer style={{
        background: '#1a1a1a',
        color: 'white',
        padding: '32px 24px',
        textAlign: 'center',
        marginTop: '48px'
      }}>
        <p style={{ opacity: 0.7, fontSize: '14px' }}>
          © 2026 Rentagun. Try before you buy.
        </p>
      </footer>

      {/* Load widget CSS */}
      <link rel="stylesheet" href="/widget.css" />
    </main>
  );
}
