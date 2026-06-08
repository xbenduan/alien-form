import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import {
  createProviders,
  initProvider,
  LocalRecordProvider,
  LocalSchemaProvider,
  registerProvider,
} from '@alien-form/cms';
import type { AlienCmsConfig } from '@alien-form/cms';
import { AppProviders } from '../providers';
import { AppRouter } from '../router';
import '../../index.css';

function registerBuiltinProviders() {
  const createRegisteredProviders = (config: AlienCmsConfig) => {
    const providers = createProviders(config);
    return {
      schema: providers.schemaProvider,
      record: providers.recordProvider,
    };
  };

  registerProvider('supabase', createRegisteredProviders);
  registerProvider('http', createRegisteredProviders);
  registerProvider('tcb', createRegisteredProviders);
}

registerBuiltinProviders();

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
