import { effect, signal, startBatch, endBatch } from "alien-signals";
import { executeCommand, type CommandMap } from "./command";
import { History } from "./history";
import { BuilderRegistry } from "./registry";
import type {
  BuilderAtom,
  BuilderError,
  BuilderRuntimeOptions,
  ReadonlyBuilderAtom,
} from "./types";

class SignalAtom<T> implements BuilderAtom<T> {
  private readonly value;

  constructor(initial: T) {
    this.value = signal(initial);
  }

  get(): T {
    return this.value();
  }

  set(value: T): void {
    this.value(value);
  }

  subscribe(listener: (value: T) => void): () => void {
    let first = true;
    return effect(() => {
      const value = this.value();
      if (!first) listener(value);
      first = false;
    });
  }
}

export class BuilderRuntime<TDocument> {
  readonly registry: BuilderRegistry;
  readonly document: ReadonlyBuilderAtom<TDocument>;
  readonly selection: ReadonlyBuilderAtom<string[]>;
  readonly dirty: ReadonlyBuilderAtom<boolean>;
  readonly errors: ReadonlyBuilderAtom<BuilderError[]>;
  readonly saving: ReadonlyBuilderAtom<boolean>;
  readonly canUndo: ReadonlyBuilderAtom<boolean>;
  readonly canRedo: ReadonlyBuilderAtom<boolean>;

  private readonly commands = new Map<string, CommandMap<TDocument>[string]>();
  private readonly history: History<TDocument>;
  private readonly clone: (document: TDocument) => TDocument;
  private readonly validate?: (document: TDocument) => BuilderError[];
  private cleanDocument: TDocument;
  private readonly documentState: BuilderAtom<TDocument>;
  private readonly selectionState = new SignalAtom<string[]>([]);
  private readonly errorState = new SignalAtom<BuilderError[]>([]);
  private readonly savingState = new SignalAtom(false);
  private readonly dirtyState = new SignalAtom(false);
  private readonly canUndoState = new SignalAtom(false);
  private readonly canRedoState = new SignalAtom(false);

  constructor(options: BuilderRuntimeOptions<TDocument>) {
    this.clone = options.clone ?? ((document) => structuredClone(document));
    const initial = this.clone(options.document);
    this.registry = options.registry ?? new BuilderRegistry();
    this.documentState = new SignalAtom(initial);
    this.document = this.documentState;
    this.selection = this.selectionState;
    this.errors = this.errorState;
    this.saving = this.savingState;
    this.dirty = this.dirtyState;
    this.canUndo = this.canUndoState;
    this.canRedo = this.canRedoState;
    this.cleanDocument = this.clone(initial);
    this.history = new History(this.clone(initial), options.historyLimit);
    this.validate = options.validate;
    this.registerCommands(options.commands ?? {});
    this.registerCommand("replaceDocument", (_document, payload) => this.clone(payload as TDocument));
    this.refreshState(initial);
  }

  registerCommand<TPayload>(
    name: string,
    command: import("./command").Command<TDocument, TPayload> | import("./command").CommandHandler<TDocument, TPayload>,
  ): void {
    this.commands.set(name, command as CommandMap<TDocument>[string]);
  }

  registerCommands(commands: CommandMap<TDocument>): void {
    for (const [name, command] of Object.entries(commands)) this.commands.set(name, command);
  }

  dispatch<TPayload = unknown>(name: string, payload: TPayload): TDocument {
    const command = this.commands.get(name);
    if (!command) throw new Error(`[alien-builder] command "${name}" is not registered`);
    const current = this.document.get();
    const next = executeCommand(command, this.clone(current), payload, { runtime: this });
    if (next === undefined) {
      throw new Error(`[alien-builder] command "${name}" returned undefined`);
    }
    const snapshot = this.clone(next);
    this.history.push(snapshot);
    this.commit(snapshot);
    return snapshot;
  }

  replaceDocument(document: TDocument): TDocument {
    return this.dispatch("replaceDocument", document);
  }

  undo(): TDocument | undefined {
    const document = this.history.undo();
    if (document !== undefined) this.commit(this.clone(document));
    return document;
  }

  redo(): TDocument | undefined {
    const document = this.history.redo();
    if (document !== undefined) this.commit(this.clone(document));
    return document;
  }

  reset(document: TDocument): void {
    const snapshot = this.clone(document);
    this.cleanDocument = this.clone(snapshot);
    this.history.reset(snapshot);
    this.commit(snapshot);
  }

  markClean(): void {
    this.cleanDocument = this.clone(this.document.get());
    this.dirtyState.set(false);
  }

  setSelection(selection: string[]): void {
    this.selectionState.set([...selection]);
  }

  setSaving(saving: boolean): void {
    this.savingState.set(saving);
  }

  setErrors(errors: BuilderError[]): void {
    this.errorState.set([...errors]);
  }

  private commit(document: TDocument): void {
    startBatch();
    try {
      this.documentState.set(document);
      this.refreshState(document);
    } finally {
      endBatch();
    }
  }

  private refreshState(document: TDocument): void {
    this.dirtyState.set(!sameValue(document, this.cleanDocument));
    this.errorState.set(this.validate?.(document) ?? []);
    this.canUndoState.set(this.history.canUndo);
    this.canRedoState.set(this.history.canRedo);
  }
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
