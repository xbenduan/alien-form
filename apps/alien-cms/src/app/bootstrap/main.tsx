import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { initProvider, LocalRecordProvider, LocalSchemaProvider } from '@alien-form/cms';
import { AppProviders } from '../providers';
import { AppRouter } from '../router';
import '../../index.css';

initProvider(({ seedDemo }: { seedDemo?: boolean }) => ({
  schema: new LocalSchemaProvider({ seedDemo }),
  record: new LocalRecordProvider({ seedDemo }),
}));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <AntdApp>
        <AppRouter />
      </AntdApp>
    </AppProviders>
  </StrictMode>,
);
