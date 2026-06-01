import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import App from './App';
import { AppProviders } from './app/providers';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <AntdApp>
        <App />
      </AntdApp>
    </AppProviders>
  </StrictMode>,
);
