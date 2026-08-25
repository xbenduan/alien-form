import { createForm, type FormInstance, type IFormSchema } from "@alien-form/core";
import type { Atom, AtomStore } from "../../store/atom";
import type { BlockSchema } from "../../dsl";
import { BlockRuntime } from "../block";
import type { PageRuntime } from "../runtime";
import type { Runtime } from "../../runtime/runtime";

interface DetailBlockOutput {
  detailSchema?: IFormSchema;
}

export class DetailBlockRuntime extends BlockRuntime {
  readonly form: FormInstance;
  readonly data: Atom<Record<string, unknown>>;
  readonly loading: Atom<boolean>;
  readonly error: Atom<Error | undefined>;

  private serviceCode: string;

  constructor(
    schema: BlockSchema,
    page: PageRuntime,
    store: AtomStore,
    runtime: Runtime,
    output: unknown,
  ) {
    super(schema, page, store, runtime);
    this.serviceCode = schema.service ?? "records.get";

    const { detailSchema } = output as DetailBlockOutput;
    this.form = createForm({
      schema: detailSchema ?? { type: "object" },
      scope: page.scope as unknown as Record<string, unknown>,
    });

    this.data = this.bridgeAtom("data", {});
    this.loading = this.bridgeAtom("loading", false);
    this.error = this.bridgeAtom("error", undefined as Error | undefined);
  }

  override mount(): void {
    this.form.mount();
    this.fetch();
  }

  override dispose(): void {
    super.dispose();
    this.form.destroy();
  }

  private async fetch(): Promise<void> {
    const id = this.page.routeParams.get().id;
    if (!id) return;
    this.loading.set(true);
    try {
      const record = (await this.page.service(this.serviceCode, { id })) as Record<string, unknown>;
      this.data.set(record);
      this.form.setValues(record);
    } catch (e) {
      this.error.set(e as Error);
    } finally {
      this.loading.set(false);
    }
  }

  refresh(): void {
    this.fetch();
  }
}
