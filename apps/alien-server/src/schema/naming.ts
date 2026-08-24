/** camelCase → snake_case（字段名 → 列名）。 */
export function toSnake(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/-/g, "_").toLowerCase();
}

/** modelCode（如 school-user）→ 物理表名（school_user）。 */
export function tableName(modelCode: string): string {
  return modelCode.replace(/-/g, "_");
}

/** 两端模型名派生 junction 表名：owner + target，字母序稳定。 */
export function junctionName(owner: string, target: string, field: string): string {
  return `${tableName(owner)}__${tableName(target)}__${toSnake(field)}`;
}
