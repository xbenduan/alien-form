import { createForm, type FieldError, type FormInstance, type IFormSchema, type RuntimeRuleHandler } from "@alien-form/core";
import type { Atom, AtomStore } from "../../store/atom";
import type { BlockSchema } from "../../dsl";
import { BlockRuntime } from "../block";
import type { PageRuntime } from "../runtime";
import type { Runtime } from "../../runtime/runtime";

interface FormBlockOutput {
  formSchema: IFormSchema;
}

export class FormBlockRuntime extends BlockRuntime {
  readonly form: FormInstance;

  readonly values: Atom<Record<string, unknown>>;
  readonly valid: Atom<boolean>;
  readonly errors: Atom<FieldError[]>;
  readonly submitting: Atom<boolean>;

  constructor(
    schema: BlockSchema,
    page: PageRuntime,
    store: AtomStore,
    runtime: Runtime,
    output: unknown,
  ) {
    super(schema, page, store, runtime);

    const { formSchema } = output as FormBlockOutput;

    const handlers = runtime.registry.form.handlers.all(page.domain) as Record<
      string,
      RuntimeRuleHandler
    >;

    this.form = createForm({
      schema: formSchema,
      scope: page.scope as unknown as Record<string, unknown>,
      handlers,
    });

    this.values = this.bridge("values", () => this.form.values());
    this.valid = this.bridge("valid", () => this.form.valid());
    this.errors = this.bridge("errors", () => this.form.errors());
    this.submitting = this.bridge("submitting", () => this.form.submitting());
  }

  override mount(): void {
    this.form.mount();
  }

  override dispose(): void {
    super.dispose();
    this.form.destroy();
  }

  setValue(path: string, value: unknown): void {
    this.form.set(path, value);
  }

  setValues(values: Record<string, unknown>): void {
    this.form.setValues(values);
  }

  async submit<T = unknown>(): Promise<T> {
    return this.form.submit<T>();
  }

  reset(): void {
    this.form.reset();
  }

  validate(): Promise<boolean> {
    return this.form.validate();
  }
}
