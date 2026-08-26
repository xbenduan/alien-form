import type { BuilderRuntime } from "./runtime";

export interface CommandContext<TDocument> {
  runtime: BuilderRuntime<TDocument>;
}

export interface Command<TDocument, TPayload = unknown> {
  execute(document: TDocument, payload: TPayload, context: CommandContext<TDocument>): TDocument;
}

export type CommandHandler<TDocument, TPayload = unknown> = (
  document: TDocument,
  payload: TPayload,
  context: CommandContext<TDocument>,
) => TDocument;

export type CommandMap<TDocument> = Record<
  string,
  Command<TDocument, any> | CommandHandler<TDocument, any>
>;

export function executeCommand<TDocument>(
  command: Command<TDocument, unknown> | CommandHandler<TDocument, unknown>,
  document: TDocument,
  payload: unknown,
  context: CommandContext<TDocument>,
): TDocument {
  return typeof command === "function"
    ? command(document, payload, context)
    : command.execute(document, payload, context);
}
