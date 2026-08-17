import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import {
  createLocalProviders,
  createProviders,
  initProvider,
  registerProvider,
} from '../../data';
import type { AlienCmsConfig } from '../../data';
import { AppProviders } from '../providers';
import { AppRouter } from '../router';
import '../../index.css';

function registerBuiltinProviders() {
  registerProvider('http', (config: AlienCmsConfig) => {
    const providers = createProviders(config);
    return {
      schema: providers.schemaProvider,
      record: providers.recordProvider,
      log: providers.logProvider,
    };
  });
}

registerBuiltinProviders();

initProvider(({ seedDemo }: { seedDemo?: boolean }) => {
  const providers = createLocalProviders({ seedDemo });
  return {
    schema: providers.schemaProvider,
    record: providers.recordProvider,
    log: providers.logProvider,
  };
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <AntdApp>
        <AppRouter />
      </AntdApp>
    </AppProviders>
  </StrictMode>,
);
