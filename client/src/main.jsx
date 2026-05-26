import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  state = { err: null };
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err, info) {
    console.error('[J! Play] render error', err, info);
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 24, color: '#fff', fontFamily: 'monospace' }}>
          <h1 style={{ color: '#FFCC00' }}>J! Play hit an error</h1>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {String(this.state.err?.stack || this.state.err)}
          </pre>
          <p>
            If you're the operator, check the browser console and your env
            vars (VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster position="top-center" toastOptions={{ style: { background: '#0A0A2E', color: '#fff', border: '1px solid #04099B' } }} />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
