export default function Offline() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'system-ui, sans-serif',
      background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          background: '#0d9488',
          borderRadius: '12px',
          margin: '0 auto 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{ color: 'white', fontSize: '24px' }}>📱</span>
        </div>
        <h1 style={{ 
          color: '#0d9488', 
          marginBottom: '10px',
          fontSize: '24px',
          fontWeight: 'bold'
        }}>
          DKJU
        </h1>
        <p style={{ 
          color: '#6b7280', 
          marginBottom: '20px',
          fontSize: '14px'
        }}>
          Smart Islamic Education
        </p>
        <h2 style={{ 
          color: '#374151', 
          marginBottom: '15px',
          fontSize: '20px'
        }}>
          You&apos;re Offline
        </h2>
        <p style={{ 
          color: '#6b7280', 
          marginBottom: '30px',
          fontSize: '16px',
          lineHeight: '1.5'
        }}>
          Please check your internet connection and try again.
        </p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            background: '#0d9488',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Try Again
        </button>
        <button 
          onClick={() => window.location.href = '/'}
          style={{
            background: 'transparent',
            color: '#0d9488',
            border: '2px solid #0d9488',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Go Home
        </button>
      </div>
    </div>
  );
}