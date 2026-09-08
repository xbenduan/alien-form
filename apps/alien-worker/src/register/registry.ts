import type { ModelRecord, ModelSchema } from "@alien-form/protocol";

export interface ModelValidationContext {
  model: ModelSchema;
  actorId: string;
  operation: "create" | "update";
  record: Readonly<ModelRecord>;
  previous?: Readonly<ModelRecord>;
}

export type ModelFieldValidator = (
  value: unknown,
  context: ModelValidationContext,
) => void | Promise<void>;

export type ModelRecordValidator = (context: ModelValidationContext) => void | Promise<void>;

export interface ModelLifecycleContext {
  model: ModelSchema;
  actorId: string;
  operation: "create" | "update" | "delete";
  record: Readonly<ModelRecord>;
  previous?: Readonly<ModelRecord>;
}

export type ModelLifecycleHook = (context: ModelLifecycleContext) => void | Promise<void>;

export interface ModelLifecycleHooks {
  beforeCreate?: ModelLifecycleHook;
  afterCreate?: ModelLifecycleHook;
  beforeUpdate?: ModelLifecycleHook;
  afterUpdate?: ModelLifecycleHook;
  beforeDelete?: ModelLifecycleHook;
  afterDelete?: ModelLifecycleHook;
}

export interface ModelRegistration {
  schema?: ModelSchema;
  validators?: Record<string, ModelFieldValidator>;
  validate?: ModelRecordValidator;
  hooks?: ModelLifecycleHooks;
}

export class ModelRegistry {
  private readonly registrations = new Map<string, ModelRegistration>();
  private frozen = false;

  model(name: string, registration: ModelRegistration): void {
    if (this.frozen) throw new Error("ModelRegistry 已冻结");
    if (this.registrations.has(name)) throw new Error(`模型重复注册：${name}`);
    if (registration.schema?.name !== undefined && registration.schema.name !== name) {
      throw new Error(`注册名与 ModelSchema.name 不一致：${name}`);
    }
    this.registrations.set(name, registration);
  }

  get(name: string): ModelRegistration | undefined {
    return this.registrations.get(name);
  }

  entries(): ReadonlyArray<readonly [string, ModelRegistration]> {
    return [...this.registrations.entries()];
  }

  freeze(): void {
    this.frozen = true;
  }
}
