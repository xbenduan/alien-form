export type BuilderError = string | { path?: string; message: string };

export interface ReadonlyBuilderAtom<T> {
  get(): T;
  subscribe(listener: (value: T) => void): () => void;
}

export interface BuilderAtom<T> extends ReadonlyBuilderAtom<T> {
  set(value: T): void;
}

export interface BuilderRuntimeOptions<TDocument> {
  document: TDocument;
  registry: import("@alien-form/engine").Registry;
  domain: string | ((document: TDocument) => string);
  commands?: import("./command").CommandMap<TDocument>;
  historyLimit?: number;
  clone?: (document: TDocument) => TDocument;
  validate?: (document: TDocument) => BuilderError[];
}
