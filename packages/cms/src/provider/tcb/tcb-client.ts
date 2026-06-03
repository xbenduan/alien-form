/**
 * Tencent CloudBase (TCB) client initialization and authentication.
 *
 * Usage:
 *   const client = createTcbClient({ envId: "your-env-id" });
 *   await client.auth();
 *   const db = client.database();
 */

import cloudbase from "@cloudbase/js-sdk";

export interface TcbClientOptions {
  /** CloudBase environment ID. */
  envId: string;
  /** Region, e.g. "ap-shanghai". Optional. */
  region?: string;
  /** Authentication type. Defaults to "anonymous". */
  authType?: "anonymous" | "custom";
  /** Custom login ticket (required when authType is "custom"). */
  ticket?: string;
  /** Collection name overrides. */
  collections?: {
    schemas?: string;
    records?: string;
    logs?: string;
  };
}

export interface TcbClient {
  /** The initialized CloudBase app instance. */
  app: any;
  /** Authenticate with CloudBase. */
  auth(): Promise<void>;
  /** Get the database instance. */
  database(): any;
  /** Get collection names. */
  collections: Required<NonNullable<TcbClientOptions["collections"]>>;
}

const DEFAULT_COLLECTIONS = {
  schemas: "alien_cms_schemas",
  records: "alien_cms_records",
  logs: "alien_cms_logs",
};

export function createTcbClient(options: TcbClientOptions): TcbClient {
  const { envId, region, authType = "anonymous", ticket, collections } = options;

  const app = cloudbase.init({ env: envId, region });
  const resolvedCollections = { ...DEFAULT_COLLECTIONS, ...collections };

  return {
    app,
    collections: resolvedCollections,

    async auth() {
      const auth = app.auth({ persistence: "local" });
      const loginState = await auth.getLoginState();

      if (loginState) {
        return;
      }

      if (authType === "anonymous") {
        await auth.anonymousAuthProvider().signIn();
      } else if (authType === "custom") {
        if (!ticket) {
          throw new Error("Custom auth requires a ticket.");
        }
        await auth.customAuthProvider().signIn(ticket);
      }
    },

    database() {
      return app.database();
    },
  };
}
