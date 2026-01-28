export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
        Rentagun Concierge Bot
      </h1>
      <p style={{ color: '#666', marginBottom: '2rem', maxWidth: '500px' }}>
        AI-powered assistant for rentagun.com. This chatbot helps customers find firearms,
        check availability, and track their rental orders.
      </p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <a
          href="/widget-demo"
          style={{
            padding: '0.75rem 1.5rem',
            background: '#c41e3a',
            color: 'white',
            borderRadius: '6px',
            fontWeight: 500
          }}
        >
          View Widget Demo
        </a>
        <a
          href="/api/health"
          style={{
            padding: '0.75rem 1.5rem',
            background: '#f0f0f0',
            color: '#333',
            borderRadius: '6px',
            fontWeight: 500
          }}
        >
          API Health Check
        </a>
      </div>
    </main>
  );
}
