import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { App } from './App';
import './styles/index.css';
import { initDevErrorReporter } from './services/devErrorReporter';

// Khởi chạy listener bắt lỗi runtime toàn cục trong môi trường DEV
initDevErrorReporter();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
