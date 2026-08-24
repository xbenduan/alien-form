import { authServices } from "./auth";
import { recordsServices } from "./records";
import { schemaServices } from "./schemas";

export const globalServices = [...recordsServices, ...schemaServices, ...authServices];
