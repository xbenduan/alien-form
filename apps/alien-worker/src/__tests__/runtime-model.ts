import type { AlienSchema } from "@alien-form/protocol";
import type {
  CompiledModel,
  ModelCommand,
  ModelEventHandler,
  ModelMiddleware,
} from "../services/core/contracts.ts";
import { compileModel } from "../storage/model-compiler.ts";

export function runtimeModel(
  schema: AlienSchema,
  options: {
    lifecycle?: ModelMiddleware;
    commands?: Readonly<Record<string, ModelCommand>>;
    eventHandlers?: Readonly<Record<string, ModelEventHandler>>;
  } = {},
): CompiledModel {
  return {
    ...compileModel(schema),
    lifecycle: options.lifecycle,
    commands: options.commands ?? {},
    eventHandlers: options.eventHandlers ?? {},
  };
}
