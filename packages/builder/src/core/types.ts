export type BuilderError = string | { path?: string; message: string };

export interface ReadonlyBuilderAtom<T> {
  get(): T;
  subscribe(listener: (value: T) => void): () => void;
}

export interface BuilderAtom<T> extends ReadonlyBuilderAtom<T> {
  set(value: T): void;
}

export interface FieldDefinition<
  TField = unknown,
  TFormField = unknown,
  TColumn = unknown,
  TComponent = unknown,
> {
  code: string;
  component: TComponent;
  authoring: {
    title: string;
    kind: "leaf" | "complex" | "layout";
    description?: string;
    container?: boolean;
    create(): TField;
  };
  projection: {
    toForm(field: TField, context: unknown): TFormField;
    toFilter(field: TField, key: string, context: unknown): TFormField | undefined;
    toColumn(field: TField, key: string, context: unknown): TColumn;
  };
}

export type AnyFieldDefinition = FieldDefinition<any, any, any, any>;

export interface BuilderRuntimeOptions<TDocument> {
  document: TDocument;
  registry?: import("./registry").BuilderRegistry;
  commands?: import("./command").CommandMap<TDocument>;
  historyLimit?: number;
  clone?: (document: TDocument) => TDocument;
  validate?: (document: TDocument) => BuilderError[];
}
