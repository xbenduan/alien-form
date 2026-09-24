import { badRequest } from "@alien-form/alienbase";

export function parseInput<T>(parse: () => T): T {
  try {
    return parse();
  } catch (reason) {
    throw badRequest(reason instanceof Error ? reason.message : String(reason));
  }
}
