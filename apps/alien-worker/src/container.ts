import { ModelStore } from "./store/model-store.ts";
import { RecordStore } from "./store/record-store.ts";
import { SessionStore } from "./store/session-store.ts";
import { RefExpander } from "./store/ref-expander.ts";
import { ModelService } from "./services/model-service.ts";
import { RecordService } from "./services/record-service.ts";
import { AuthService } from "./services/auth/auth-service.ts";
import { modelRegistry, type ModelRegistry } from "./register/index.ts";

/**
 * 依赖容器：一次装配 store + service 并互相注入。
 *
 * D1 无连接开销（binding 即客户端），每请求 new 一个容器即可，既拿到干净的作用域，
 * 又避免跨请求共享可变状态。构造顺序体现依赖方向：store → service。
 */
export class Container {
  readonly modelStore: ModelStore;
  readonly recordStore: RecordStore;
  readonly sessionStore: SessionStore;
  readonly refExpander: RefExpander;

  readonly modelService: ModelService;
  readonly recordService: RecordService;
  readonly authService: AuthService;

  constructor(
    readonly db: D1Database,
    readonly models: ModelRegistry = modelRegistry,
  ) {
    this.modelStore = new ModelStore(db);
    this.recordStore = new RecordStore(db);
    this.sessionStore = new SessionStore(db);
    this.refExpander = new RefExpander(db, this.modelStore);

    this.modelService = new ModelService(this.modelStore);
    this.recordService = new RecordService(
      this.modelStore,
      this.recordStore,
      this.refExpander,
      models,
    );
    this.authService = new AuthService(this.modelStore, this.recordStore, this.sessionStore);
  }
}
