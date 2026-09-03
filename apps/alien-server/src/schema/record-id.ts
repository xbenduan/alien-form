/** 记录主键（业务 id）格式：前缀 + 零填充自增序号，如 MDM0000000001。 */
export const ID_PREFIX = "MDM";
export const ID_PAD = 10;

/** 把自增序号格式化为业务主键，如 1 -> "MDM0000000001"。 */
export function formatRecordId(seq: number): string {
  return `${ID_PREFIX}${String(seq).padStart(ID_PAD, "0")}`;
}
