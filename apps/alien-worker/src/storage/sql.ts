const identifier = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const columnIdentifier = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function quoteTable(value: string): string {
  if (!identifier.test(value)) throw new Error(`非法表名：${value}`);
  return `"${value}"`;
}

export function quoteColumn(value: string): string {
  if (!columnIdentifier.test(value)) throw new Error(`非法列名：${value}`);
  return `"${value}"`;
}

export function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
