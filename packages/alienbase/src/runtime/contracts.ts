import type {
  AlienSchema,
  AlienValue,
  MigrationPlan,
  ModelRecord,
  ModelSummary,
  Pagination,
  PermissionAction,
  Sorter,
  StorageManifest,
} from "@alien-form/protocol";

export interface CompiledFieldPlan {
  readonly field: string;
  readonly type: NonNullable<AlienSchema["fields"][number]["storage"]>["type"];
  readonly storage: "physical" | "virtual";
  readonly column?: string;
  readonly json: boolean;
  readonly filterable: boolean;
  readonly sortable: boolean;
}

export interface CompiledModel {
  readonly key: `${string}@${number}`;
  readonly schema: AlienSchema;
  readonly storage: StorageManifest;
  readonly query: {
    readonly fields: ReadonlyMap<string, CompiledFieldPlan>;
  };
  readonly policy: {
    readonly publicFields: ReadonlySet<string>;
    readonly privateFields: ReadonlySet<string>;
  };
  readonly validation: {
    readonly fields: ReadonlyMap<string, AlienSchema["fields"][number]>;
  };
  readonly lifecycle?: ModelMiddleware;
  readonly commands: Readonly<Record<string, ModelCommand>>;
  readonly eventHandlers: Readonly<Record<string, ModelEventHandler>>;
}

export interface CompiledModelProvider {
  get(modelCode: string): Promise<CompiledModel | undefined>;
  require(modelCode: string): Promise<CompiledModel>;
  invalidate(modelCode: string): void;
}

/** 代码内声明的系统模型目录，不参与模型协议持久化。 */
export interface CodeModelCatalog {
  /** 返回所有代码模型的不可变协议。 */
  list(): Promise<readonly AlienSchema[]>;
  /** 判断模型名是否由代码占用。 */
  has(modelCode: string): Promise<boolean>;
}

export class ModelVersionConflictError extends Error {}

/** 用户模型协议仓储；代码系统模型不得写入该端口。 */
export interface ModelRepository {
  list(): Promise<ModelSummary[]>;
  get(name: string): Promise<AlienSchema | undefined>;
  has(name: string): Promise<boolean>;
  publish(
    current: AlienSchema | undefined,
    schema: AlienSchema,
    expectedVersion: number,
  ): Promise<AlienSchema>;
  delete(schema: AlienSchema): Promise<void>;
}

export interface RecordListParams {
  filter?: string;
  authId: string;
  pagination?: Pagination;
  sorter?: Sorter;
  keyword?: string;
  searchFields?: string[];
  parentId?: string | null;
  idField?: string;
  parentField?: string;
  ownerId?: string;
}

export interface RecordListResult {
  list: ModelRecord[];
  total: number;
}

export interface RecordOptionsParams {
  valueKey: string;
  labelKey: string;
  keyword?: string;
  selectedValues?: unknown[];
  limit?: number;
  ownerId?: string;
}

export interface RecordOptionResult {
  options: Array<{ value: string | number; label: string }>;
  total: number;
}

export interface RecordSubtreeParams {
  idField: string;
  parentField: string;
  parentValue?: string | null;
  ownerId?: string;
}

export interface RecordReader {
  allocateId(): Promise<string>;
  list(model: CompiledModel, params: RecordListParams): Promise<RecordListResult>;
  options(model: CompiledModel, params: RecordOptionsParams): Promise<RecordOptionResult>;
  subtree(model: CompiledModel, params: RecordSubtreeParams): Promise<ModelRecord[]>;
  get(model: CompiledModel, id: string): Promise<ModelRecord | undefined>;
  findByField(
    model: CompiledModel,
    field: string,
    value: string | number,
  ): Promise<ModelRecord | undefined>;
  owner(model: CompiledModel, id: string): Promise<string | undefined>;
}

export type RecordMutation =
  | {
      readonly operation: "create";
      readonly model: CompiledModel;
      readonly record: ModelRecord;
      readonly ownerId: string;
    }
  | {
      readonly operation: "update";
      readonly model: CompiledModel;
      readonly id: string;
      readonly record: ModelRecord;
      readonly ownerId?: string;
    }
  | {
      readonly operation: "delete";
      readonly model: CompiledModel;
      readonly id: string;
    };

export interface DomainEvent {
  readonly id: string;
  readonly model: string;
  readonly topic: string;
  readonly payload: AlienValue;
  readonly occurredAt: number;
}

export interface TransactionPlan {
  readonly mutations: readonly RecordMutation[];
  readonly events: readonly DomainEvent[];
}

export interface UnitOfWork {
  commit(plan: TransactionPlan): Promise<void>;
}

export interface OutboxRecord extends DomainEvent {
  readonly attempts: number;
}

export interface OutboxRepository {
  pending(limit: number): Promise<readonly OutboxRecord[]>;
  markProcessed(id: string, processedAt: number): Promise<void>;
  markFailed(id: string, reason: string): Promise<void>;
}

export interface RecordExpander {
  expand(schema: AlienSchema, records: ModelRecord[]): Promise<ModelRecord[]>;
  expandOne(schema: AlienSchema, record: ModelRecord): Promise<ModelRecord>;
}

export type ModelWriteOperation = "create" | "update" | "delete";
export type ModelReadOperation = "list" | "get" | "create" | "update" | "subtree" | "command";

interface ModelDataContext {
  models: Pick<CompiledModelProvider, "get">;
  records: Pick<RecordReader, "get" | "findByField" | "subtree">;
}

export interface ModelPrepareContext {
  actorId: string;
  operation: "create" | "update";
  previous?: Readonly<ModelRecord>;
}

export type ModelPrepareMiddleware = (
  values: Readonly<Record<string, unknown>>,
  context: ModelPrepareContext,
) => Record<string, unknown> | Promise<Record<string, unknown>>;

export interface EventCollector {
  emit(topic: string, payload: AlienValue): void;
}

export interface ModelValidationContext extends ModelDataContext {
  model: CompiledModel;
  actorId: string;
  operation: "create" | "update";
  record: Readonly<ModelRecord>;
  previous?: Readonly<ModelRecord>;
}

export type ModelValidateMiddleware = (context: ModelValidationContext) => void | Promise<void>;

export interface ModelPersistContext extends ModelDataContext {
  model: CompiledModel;
  actorId: string;
  operation: ModelWriteOperation;
  record: Readonly<ModelRecord>;
  previous?: Readonly<ModelRecord>;
  events: EventCollector;
}

export type ModelPersistMiddleware = (context: ModelPersistContext) => void | Promise<void>;

export interface ModelPresentContext {
  model: CompiledModel;
  actorId: string;
  operation: ModelReadOperation;
}

export type ModelPresentMiddleware = (
  record: Readonly<ModelRecord>,
  context: ModelPresentContext,
) => ModelRecord | Promise<ModelRecord>;

export interface ModelMiddleware {
  prepare?: ModelPrepareMiddleware;
  validate?: ModelValidateMiddleware;
  beforePersist?: ModelPersistMiddleware;
  present?: ModelPresentMiddleware;
}

export type ModelCommandMutation =
  | { readonly operation: "create"; readonly values: Readonly<Record<string, unknown>> }
  | {
      readonly operation: "update";
      readonly id: string;
      readonly values: Readonly<Record<string, unknown>>;
    }
  | { readonly operation: "delete"; readonly id: string };

export interface ModelCommandContext extends ModelDataContext {
  readonly actorId: string;
  readonly model: AlienSchema;
  readonly now: number;
}

export interface ModelCommandResult {
  readonly mutations: readonly ModelCommandMutation[];
  readonly events?: readonly {
    readonly topic: string;
    readonly payload: AlienValue;
  }[];
  readonly output?: AlienValue;
}

export interface ModelCommand {
  readonly permission: PermissionAction;
  readonly writeFields: readonly string[];
  execute(input: unknown, context: ModelCommandContext): Promise<ModelCommandResult>;
}

export interface ModelEventHandlerContext {
  readonly eventId: string;
  readonly model: string;
  readonly occurredAt: number;
}

export type ModelEventHandler = (
  payload: AlienValue,
  context: ModelEventHandlerContext,
) => void | Promise<void>;

export interface ModelPublication {
  readonly schema: AlienSchema;
  readonly manifest: StorageManifest;
  readonly migration: MigrationPlan;
}
