export type RecordRouteMode = "add" | "edit" | "detail";

export function recordRoute(modelCode: string, mode: RecordRouteMode, recordId?: unknown): string {
  const base = `/records/${encodeURIComponent(modelCode)}/${mode}`;
  if (mode === "add") return base;
  if (recordId === undefined || recordId === null || recordId === "") {
    throw new Error(`Record id is required for ${mode}`);
  }
  return `${base}?id=${encodeURIComponent(String(recordId))}`;
}
