import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { AppProviders } from './app/providers';
import { AppRouter } from './app/router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <AntdApp>
        <AppRouter />
      </AntdApp>
    </AppProviders>
  </StrictMode>,
);
