import type { ColumnPlan } from "../schema/field-plan.ts";

/**
 * 值编解码：JS 值 ⟷ SQLite 列值。
 *  - json 列：对象/数组 ⟷ JSON 字符串
 *  - boolean 列：true/false ⟷ 1/0
 *  - real/integer 列：数字原样
 *  - text 列：字符串原样
 */

/** 写入：JS 值 → 可绑定到 SQLite 的原始值（string | number | null）。 */
export function encode(plan: ColumnPlan, value: unknown): string | number | null {
  if (value === undefined || value === null) return null;
  if (plan.json) return JSON.stringify(value);
  if (plan.type === "boolean") return value ? 1 : 0;
  if (plan.type === "real" || plan.type === "integer") {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return typeof value === "string" ? value : String(value);
}

/** 读取：SQLite 列值 → JS 值。 */
export function decode(plan: ColumnPlan, raw: unknown): unknown {
  if (raw === undefined || raw === null) return null;
  if (plan.json) {
    if (typeof raw !== "string") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  if (plan.type === "boolean") return raw === 1 || raw === true || raw === "1";
  return raw;
}
