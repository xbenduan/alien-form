import { z } from "zod";
import { definitionStructureSchema } from "../model/schema";

/** 从同一作者契约生成机器可读结构，format 语义由 models.validate 进一步检查。 */
export const definitionJsonSchema = z.toJSONSchema(definitionStructureSchema, { io: "input" });
