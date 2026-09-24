import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { App } from './App';
import './styles/index.css';
import { initDevErrorReporter, sendDevError } from './services/devErrorReporter';

// Khởi chạy listener bắt lỗi runtime toàn cục trong môi trường DEV
initDevErrorReporter();

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class DevErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    sendDevError({
      errorType: 'REACT_ERROR_BOUNDARY',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack || undefined,
      url: typeof window !== 'undefined' ? window.location.href : '',
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '28px', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '40px auto', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🚨</span>
            <h2 style={{ color: '#be123c', margin: 0, fontSize: '18px', fontWeight: 700 }}>Phát hiện lỗi giao diện (React Render Error)</h2>
          </div>
          <p style={{ color: '#881337', fontSize: '14px', marginTop: '12px', lineHeight: 1.5 }}>
            Lỗi này đã được <strong>tự động bắt và ghi vào <code>app_errors.log</code></strong> tại thư mục gốc dự án để hỗ trợ agent phân tích và sửa mã nguồn.
          </p>
          <pre style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', overflowX: 'auto', border: '1px solid #fda4af', color: '#9f1239', fontSize: '12px', lineHeight: 1.5 }}>
            {this.state.error?.stack || this.state.error?.message}
          </pre>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{ marginTop: '16px', padding: '10px 20px', background: '#e11d48', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            Tải lại trang (Reload)
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lưu tham chiếu Root trên window để HMR không tạo đè root mới gây lỗi ReactDOMClient.createRoot
const container = document.getElementById('root') as HTMLElement;
let root = (window as any).__metro2_react_root__ as ReactDOM.Root | undefined;
if (!root) {
  root = ReactDOM.createRoot(container);
  (window as any).__metro2_react_root__ = root;
}

root.render(
  <React.StrictMode>
    <DevErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </DevErrorBoundary>
  </React.StrictMode>
);
