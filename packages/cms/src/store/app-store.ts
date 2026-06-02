import { signal, computed } from "@alien-form/core";
import type { Signal, Computed } from "@alien-form/core";
import type { SchemaProvider } from "../provider/schema-provider";
import type { RecordProvider } from "../provider/record-provider";
import type { AlienCmsConfig } from "../types/config";
import type { CmsModelSchema, ModelSummary } from "../types/schema";
import { ModelPageStore } from "./model-page-store";
import { ModelBuilderStore } from "./model-builder-store";

export type ConnectionMode = "local" | "remote";

export interface AuthState {
  authenticated: boolean;
  token?: string;
  expiresAt?: number;
}

export interface AppStoreConfig {
  /** Local providers for offline/IndexedDB mode. */
  localSchemaProvider: SchemaProvider;
  localRecordProvider: RecordProvider;
  /** Optional: factory to create remote providers from config. */
  createRemoteProviders?: (config: AlienCmsConfig, token?: string) => {
    schemaProvider: SchemaProvider;
    recordProvider: RecordProvider;
  };
}

/**
 * Root application store. Manages connection mode, authentication,
 * model listing, and creates child stores for pages.
 */
export class AppStore {
  private readonly config_: AppStoreConfig;

  // ─── Connection ─────────────────────────────────────────────
  readonly connectionMode: Signal<ConnectionMode>;
  readonly remoteConfig: Signal<AlienCmsConfig | undefined>;
  readonly connected: Signal<boolean>;
  readonly connecting: Signal<boolean>;
  readonly authState: Signal<AuthState>;

  // ─── Models ─────────────────────────────────────────────────
  readonly models: Signal<ModelSummary[]>;
  readonly modelsLoading: Signal<boolean>;

  // ─── Derived providers ──────────────────────────────────────
  readonly schemaProvider: Computed<SchemaProvider>;
  readonly recordProvider: Computed<RecordProvider>;

  private remoteSchemaProvider?: SchemaProvider;
  private remoteRecordProvider?: RecordProvider;

  constructor(config: AppStoreConfig) {
    this.config_ = config;

    this.connectionMode = signal<ConnectionMode>("local");
    this.remoteConfig = signal<AlienCmsConfig | undefined>(undefined);
    this.connected = signal(false);
    this.connecting = signal(false);
    this.authState = signal<AuthState>({ authenticated: false });

    this.models = signal<ModelSummary[]>([]);
    this.modelsLoading = signal(false);

    this.schemaProvider = computed(() => {
      if (this.connectionMode() === "remote" && this.remoteSchemaProvider) {
        return this.remoteSchemaProvider;
      }
      return this.config_.localSchemaProvider;
    });

    this.recordProvider = computed(() => {
      if (this.connectionMode() === "remote" && this.remoteRecordProvider) {
        return this.remoteRecordProvider;
      }
      return this.config_.localRecordProvider;
    });
  }

  // ─── Connection Management ──────────────────────────────────

  async connect(config: AlienCmsConfig): Promise<void> {
    this.connecting(true);
    try {
      this.remoteConfig(config);

      if (this.config_.createRemoteProviders) {
        const token = this.authState().token;
        const providers = this.config_.createRemoteProviders(config, token);
        this.remoteSchemaProvider = providers.schemaProvider;
        this.remoteRecordProvider = providers.recordProvider;
      }

      this.connectionMode("remote");
      this.connected(true);
      await this.loadModels();
    } finally {
      this.connecting(false);
    }
  }

  disconnect(): void {
    this.connectionMode("local");
    this.connected(false);
    this.remoteConfig(undefined);
    this.remoteSchemaProvider = undefined;
    this.remoteRecordProvider = undefined;
    this.authState({ authenticated: false });
    this.loadModels();
  }

  setAuthState(state: AuthState): void {
    this.authState(state);
    // Re-create remote providers with new token
    const config = this.remoteConfig();
    if (config && this.config_.createRemoteProviders && state.token) {
      const providers = this.config_.createRemoteProviders(config, state.token);
      this.remoteSchemaProvider = providers.schemaProvider;
      this.remoteRecordProvider = providers.recordProvider;
    }
  }

  // ─── Model List ─────────────────────────────────────────────

  async loadModels(): Promise<void> {
    this.modelsLoading(true);
    try {
      const result = await this.schemaProvider().list();
      this.models(result.list);
    } finally {
      this.modelsLoading(false);
    }
  }

  // ─── Child Store Factories ──────────────────────────────────

  createModelPageStore(
    modelName: string,
    schema: CmsModelSchema,
    options?: { tableVisibleKeys?: string[] },
  ): ModelPageStore {
    return new ModelPageStore({
      modelName,
      schema,
      recordProvider: this.recordProvider(),
      tableVisibleKeys: options?.tableVisibleKeys,
    });
  }

  createModelBuilderStore(): ModelBuilderStore {
    return new ModelBuilderStore(this.schemaProvider());
  }
}
