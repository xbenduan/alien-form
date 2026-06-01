import { signal, computed } from "@alien-form/core";
import type { Signal, Computed } from "@alien-form/core";
import type { SchemaProvider } from "../provider/schema-provider";
import type { CmsModelSchema, ModelSummary } from "../types/schema";
import type { ModelBuilderDraft, ModelBuilderFieldDraft, BuilderFieldType, BuilderComponentName } from "../types/builder";
import { buildModelSchema } from "../schema/build-model-schema";

// ─── Helpers ──────────────────────────────────────────────────

let fieldCounter = 0;

function createFieldDraft(type: BuilderFieldType, component: BuilderComponentName): ModelBuilderFieldDraft {
  const timestamp = Date.now();
  const suffix = `${(++fieldCounter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const defaultTitle: Record<BuilderFieldType, string> = {
    string: "Text Field",
    number: "Number Field",
    boolean: "Boolean Field",
    object: "Object Group",
    void: "Layout Group",
    array: "Array Field",
  };
  const isContainer = type === "object" || type === "void";
  const isObjectArray = type === "array" && component === "ArrayCards";

  return {
    id: `field-${timestamp}-${suffix}`,
    key: `field_${timestamp}_${suffix}`,
    title: defaultTitle[type],
    type,
    component,
    decorator: isContainer ? undefined : "FormItem",
    required: false,
    defaultValueText: "",
    propsText: "{}",
    dataSourceText: "",
    filterVisible: !isContainer && type !== "array",
    filterDefaultVisible: false,
    tableVisible: !isContainer,
    tableWidthText: "",
    tableEllipsis: true,
    detailVisible: true,
    reactions: [],
    children: isContainer || isObjectArray ? [] : undefined,
    arrayMode: type === "array" ? (component === "ArrayCards" ? "object" : "tags") : undefined,
    itemTitle: isObjectArray ? "Item" : undefined,
  };
}

function createInitialDraft(): ModelBuilderDraft {
  return {
    modelName: "",
    title: "New Model",
    subtitle: "",
    description: "",
    singularLabel: "Record",
    pluralLabel: "Records",
    defaultPageSize: 10,
    defaultFilterCount: 3,
    openMode: { add: "drawer", edit: "drawer", detail: "drawer" },
    fields: [createFieldDraft("string", "Input")],
  };
}

function findFieldById(fields: ModelBuilderFieldDraft[], id?: string): ModelBuilderFieldDraft | undefined {
  for (const field of fields) {
    if (field.id === id) return field;
    if (field.children?.length) {
      const child = findFieldById(field.children, id);
      if (child) return child;
    }
  }
  return undefined;
}

function removeFieldById(fields: ModelBuilderFieldDraft[], id: string): ModelBuilderFieldDraft[] {
  return fields
    .filter((f) => f.id !== id)
    .map((f) => ({
      ...f,
      children: f.children ? removeFieldById(f.children, id) : f.children,
    }));
}

function updateFieldInTree(
  fields: ModelBuilderFieldDraft[],
  id: string,
  updater: (f: ModelBuilderFieldDraft) => ModelBuilderFieldDraft,
): ModelBuilderFieldDraft[] {
  return fields.map((f) => {
    if (f.id === id) return updater(f);
    if (f.children?.length) {
      return { ...f, children: updateFieldInTree(f.children, id, updater) };
    }
    return f;
  });
}

function collectFieldIds(fields: ModelBuilderFieldDraft[]): string[] {
  return fields.flatMap((f) => [f.id, ...(f.children ? collectFieldIds(f.children) : [])]);
}

// ─── Store ────────────────────────────────────────────────────

export interface FieldPreset {
  type: BuilderFieldType;
  component: BuilderComponentName;
}

export class ModelBuilderStore {
  private readonly provider: SchemaProvider;

  // ─── Model list ─────────────────────────────────────────────
  readonly models: Signal<ModelSummary[]>;
  readonly modelsLoading: Signal<boolean>;

  // ─── Current draft ──────────────────────────────────────────
  readonly draft: Signal<ModelBuilderDraft>;
  readonly editingModelName: Signal<string | undefined>;
  readonly selectedFieldId: Signal<string | undefined>;
  readonly saving: Signal<boolean>;

  // ─── Preview ────────────────────────────────────────────────
  readonly previewSchema: Computed<CmsModelSchema | undefined>;
  readonly previewError: Computed<string | undefined>;

  constructor(provider: SchemaProvider) {
    this.provider = provider;
    this.models = signal<ModelSummary[]>([]);
    this.modelsLoading = signal(false);

    const initialDraft = createInitialDraft();
    this.draft = signal<ModelBuilderDraft>(initialDraft);
    this.editingModelName = signal<string | undefined>(undefined);
    this.selectedFieldId = signal<string | undefined>(initialDraft.fields[0]?.id);
    this.saving = signal(false);

    this.previewSchema = computed(() => {
      try {
        return buildModelSchema(this.draft());
      } catch {
        return undefined;
      }
    });

    this.previewError = computed(() => {
      try {
        buildModelSchema(this.draft());
        return undefined;
      } catch (e) {
        return e instanceof Error ? e.message : "Preview generation failed";
      }
    });
  }

  // ─── Schema List ────────────────────────────────────────────

  async fetchModels(): Promise<void> {
    this.modelsLoading(true);
    try {
      const result = await this.provider.list();
      this.models(result.list);
    } finally {
      this.modelsLoading(false);
    }
  }

  // ─── Schema CRUD ────────────────────────────────────────────

  async loadForEdit(modelName: string): Promise<void> {
    const schema = await this.provider.detail({ modelName });
    // TODO: reverse-engineer draft from schema
    this.editingModelName(modelName);
  }

  async createModel(): Promise<boolean> {
    const errors = this.validate();
    if (errors.length > 0) return false;

    this.saving(true);
    try {
      const schema = buildModelSchema(this.draft());
      const result = await this.provider.create({ schema });
      if (result.success) {
        await this.fetchModels();
        return true;
      }
      return false;
    } finally {
      this.saving(false);
    }
  }

  async updateModel(): Promise<boolean> {
    const modelName = this.editingModelName();
    if (!modelName) return false;

    const errors = this.validate();
    if (errors.length > 0) return false;

    this.saving(true);
    try {
      const schema = buildModelSchema(this.draft());
      const result = await this.provider.update({ modelName, schema });
      if (result.success) {
        await this.fetchModels();
        return true;
      }
      return false;
    } finally {
      this.saving(false);
    }
  }

  async deleteModel(modelName: string): Promise<boolean> {
    const result = await this.provider.delete({ modelName });
    if (result.success) {
      await this.fetchModels();
      return true;
    }
    return false;
  }

  // ─── Draft Operations ───────────────────────────────────────

  updateDraft(updater: (d: ModelBuilderDraft) => ModelBuilderDraft): void {
    this.draft(updater(this.draft()));
  }

  addField(preset: FieldPreset, parentId?: string): void {
    const nextField = createFieldDraft(preset.type, preset.component);
    if (parentId) {
      this.draft(
        {
          ...this.draft(),
          fields: updateFieldInTree(this.draft().fields, parentId, (f) => ({
            ...f,
            children: [...(f.children ?? []), nextField],
          })),
        },
      );
    } else {
      this.draft({ ...this.draft(), fields: [...this.draft().fields, nextField] });
    }
    this.selectedFieldId(nextField.id);
  }

  removeField(fieldId: string): void {
    const nextFields = removeFieldById(this.draft().fields, fieldId);
    this.draft({ ...this.draft(), fields: nextFields });
    const remaining = collectFieldIds(nextFields);
    if (this.selectedFieldId() && !remaining.includes(this.selectedFieldId()!)) {
      this.selectedFieldId(remaining[0]);
    }
  }

  moveField(fromIndex: number, toIndex: number): void {
    const fields = [...this.draft().fields];
    const [moved] = fields.splice(fromIndex, 1);
    fields.splice(toIndex, 0, moved);
    this.draft({ ...this.draft(), fields });
  }

  updateField(fieldId: string, updater: (f: ModelBuilderFieldDraft) => ModelBuilderFieldDraft): void {
    this.draft({
      ...this.draft(),
      fields: updateFieldInTree(this.draft().fields, fieldId, updater),
    });
  }

  getSelectedField(): ModelBuilderFieldDraft | undefined {
    return findFieldById(this.draft().fields, this.selectedFieldId());
  }

  resetDraft(): void {
    const d = createInitialDraft();
    this.draft(d);
    this.editingModelName(undefined);
    this.selectedFieldId(d.fields[0]?.id);
  }

  // ─── Validation ─────────────────────────────────────────────

  validate(): string[] {
    const errors: string[] = [];
    const draft = this.draft();

    if (!draft.modelName.trim()) {
      errors.push("Model name is required");
    } else if (!/^[a-z][a-z0-9-]*$/.test(draft.modelName.trim())) {
      errors.push("Model name must be lowercase letters, numbers, and hyphens, starting with a letter");
    }

    if (!draft.title.trim()) {
      errors.push("Model title is required");
    }

    if (draft.fields.length === 0) {
      errors.push("At least one field is required");
    }

    const validateFields = (fields: ModelBuilderFieldDraft[], path: string) => {
      const keys = new Set<string>();
      for (const field of fields) {
        const label = `${path}/${field.title || "untitled"}`;
        if (!field.key.trim()) {
          errors.push(`${label}: key is required`);
        }
        if (keys.has(field.key.trim())) {
          errors.push(`${label}: duplicate key "${field.key.trim()}"`);
        }
        keys.add(field.key.trim());

        const needsChildren = field.type === "object" || field.type === "void" ||
          (field.type === "array" && field.arrayMode === "object");
        if (needsChildren && (!field.children || field.children.length === 0)) {
          errors.push(`${label}: container field needs at least one child`);
        }

        if (field.children?.length) {
          validateFields(field.children, label);
        }
      }
    };

    validateFields(draft.fields, draft.title.trim() || "model");
    return errors;
  }

  dispose(): void {
    // Future cleanup
  }
}
