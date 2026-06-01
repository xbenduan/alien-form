/**
 * alien-cms-config.json type definitions.
 * Describes how to connect to a remote backend.
 */

export type AuthType = "oauth2" | "apiKey" | "basic" | "bearer" | "custom";

export interface OAuth2Config {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  scopes?: string[];
  redirectPath?: string;
  pkce?: boolean;
}

export interface ApiKeyConfig {
  header: string;
  value?: string;
}

export interface BasicAuthConfig {
  username?: string;
  password?: string;
}

export interface BearerConfig {
  token?: string;
}

export interface CustomAuthConfig {
  loginUrl: string;
  method: "POST" | "GET";
  body?: Record<string, unknown>;
  tokenPath: string;
  tokenHeader: string;
  tokenPrefix?: string;
}

export interface AuthConfig {
  type: AuthType;
  oauth2?: OAuth2Config;
  apiKey?: ApiKeyConfig;
  basic?: BasicAuthConfig;
  bearer?: BearerConfig;
  custom?: CustomAuthConfig;
}

export interface EndpointConfig {
  schema?: {
    list?: string;
    detail?: string;
  };
  records: {
    list: string;
    detail: string;
    create: string;
    update: string;
    delete: string;
  };
  upload?: {
    url: string;
    responseUrlPath?: string;
  };
}

export interface AdapterRequestListConfig {
  pagination?: {
    currentKey?: string;
    pageSizeKey?: string;
    strategy?: "pageNumber" | "offset";
  };
  sorter?: {
    fieldKey?: string;
    orderKey?: string;
    ascValue?: string;
    descValue?: string;
  };
  filters?: {
    strategy?: "flat" | "nested" | "body";
  };
}

export interface AdapterResponseConfig {
  dataPath?: string;
  totalPath?: string;
}

export interface AdapterConfig {
  request?: {
    list?: AdapterRequestListConfig;
  };
  response?: {
    list?: AdapterResponseConfig;
    detail?: Pick<AdapterResponseConfig, "dataPath">;
    create?: Pick<AdapterResponseConfig, "dataPath">;
    update?: Pick<AdapterResponseConfig, "dataPath">;
  };
}

export interface SchemaSourceConfig {
  strategy: "remote" | "local" | "hybrid";
  localSchemas?: Record<string, string>;
}

export interface ConnectionOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  cache?: {
    schemaMaxAge?: number;
    listMaxAge?: number;
  };
}

export interface AlienCmsConfig {
  $schema?: string;
  version: "1.0";
  name: string;
  description?: string;
  baseUrl: string;
  auth: AuthConfig;
  endpoints: EndpointConfig;
  adapter: AdapterConfig;
  schemaSource: SchemaSourceConfig;
  options?: ConnectionOptions;
}
