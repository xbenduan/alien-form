import { ModelStore } from "./store/model-store.ts";
import { OutboxStore } from "./store/outbox-store.ts";
import { RecordStore } from "./store/record-store.ts";
import { SessionStore } from "./store/session-store.ts";
import { RefExpander } from "./store/ref-expander.ts";
import { RoleAccessProfileProvider } from "./services/auth/access-profile-provider.ts";
import { AuthService } from "./services/auth/auth-service.ts";
import { CompiledModels } from "./services/compiled-models.ts";
import { AccessControl } from "./services/core/access-control.ts";
import { ModelService } from "./services/core/model-service.ts";
import { RecordService } from "./services/core/record-service.ts";
import { OutboxDispatcher } from "./services/events/outbox-dispatcher.ts";
import { SystemModelGroupPolicy } from "./services/model-group-policy.ts";
import { modelModules, type ModelModules } from "./services/model-modules.ts";
import categoryModule from "./services/models/_sys_model_category/index.ts";

/**
 * 依赖容器：一次装配 store + service 并互相注入。
 *
 * D1 无连接开销（binding 即客户端），每请求 new 一个容器即可，既拿到干净的作用域，
 * 又避免跨请求共享可变状态。构造顺序体现依赖方向：store → service。
 */
export class Container {
  readonly modelStore: ModelStore;
  readonly compiledModels: CompiledModels;
  readonly recordStore: RecordStore;
  readonly outboxStore: OutboxStore;
  readonly sessionStore: SessionStore;
  readonly refExpander: RefExpander;
  readonly accessProfileProvider: RoleAccessProfileProvider;
  readonly accessControl: AccessControl;

  readonly modelService: ModelService;
  readonly recordService: RecordService;
  readonly authService: AuthService;
  readonly outboxDispatcher: OutboxDispatcher;

  constructor(
    readonly db: D1Database,
    readonly modules: ModelModules = modelModules,
  ) {
    this.modelStore = new ModelStore(db);
    this.compiledModels = new CompiledModels(this.modelStore, modules);
    this.recordStore = new RecordStore(db);
    this.outboxStore = new OutboxStore(db);
    this.sessionStore = new SessionStore(db);
    this.refExpander = new RefExpander(db, this.compiledModels);
    this.accessProfileProvider = new RoleAccessProfileProvider(
      this.compiledModels,
      this.recordStore,
    );
    this.accessControl = new AccessControl(this.accessProfileProvider, {
      publicModelNames: new Set([categoryModule.schema.name]),
    });

    this.modelService = new ModelService(
      this.modelStore,
      this.accessControl,
      this.compiledModels,
      new SystemModelGroupPolicy(this.compiledModels, this.recordStore),
    );
    this.recordService = new RecordService(
      this.compiledModels,
      this.recordStore,
      this.recordStore,
      this.refExpander,
      this.accessControl,
    );
    this.authService = new AuthService(
      this.compiledModels,
      this.recordStore,
      this.sessionStore,
      this.accessProfileProvider,
    );
    this.outboxDispatcher = new OutboxDispatcher(this.outboxStore, this.compiledModels);
  }
}
