import { SchemaStore } from "./store/schema-store.ts";
import { RecordStore } from "./store/record-store.ts";
import { SessionStore } from "./store/session-store.ts";
import { RefExpander } from "./store/ref-expander.ts";
import { SchemaService } from "./services/schema-service.ts";
import { RecordService } from "./services/record-service.ts";
import { AuthService } from "./services/auth/auth-service.ts";

/**
 * 依赖容器：一次装配 store + service 并互相注入。
 *
 * D1 无连接开销（binding 即客户端），每请求 new 一个容器即可，既拿到干净的作用域，
 * 又避免跨请求共享可变状态。构造顺序体现依赖方向：store → service。
 */
export class Container {
  readonly schemaStore: SchemaStore;
  readonly recordStore: RecordStore;
  readonly sessionStore: SessionStore;
  readonly refExpander: RefExpander;

  readonly schemaService: SchemaService;
  readonly recordService: RecordService;
  readonly authService: AuthService;

  constructor(readonly db: D1Database) {
    this.schemaStore = new SchemaStore(db);
    this.recordStore = new RecordStore(db);
    this.sessionStore = new SessionStore(db);
    this.refExpander = new RefExpander(db, this.schemaStore);

    this.schemaService = new SchemaService(this.schemaStore);
    this.recordService = new RecordService(this.schemaStore, this.recordStore, this.refExpander);
    this.authService = new AuthService(this.schemaStore, this.recordStore, this.sessionStore);
  }
}
