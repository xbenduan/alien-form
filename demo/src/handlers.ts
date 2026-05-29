import type { FormConfig } from "@alien-form/react";

/**
 * 笛卡尔积生成 SKU 列表
 * 当 specs 变化时自动触发，保留已存在 SKU 的价格/库存/状态
 */
function cartesian(specs: Array<{ name: string; values: string[] }>): Record<string, string>[] {
  if (!specs || specs.length === 0) return [];
  // Filter out specs with empty name or no values
  const valid = specs.filter((s) => s.name && s.values && s.values.length > 0);
  if (valid.length === 0) return [];

  return valid.reduce<Record<string, string>[]>(
    (acc, spec) => {
      const result: Record<string, string>[] = [];
      for (const combo of acc) {
        for (const val of spec.values) {
          result.push({ ...combo, [spec.name]: val });
        }
      }
      return result;
    },
    [{}],
  );
}

/** Create a stable key for a SKU combination (sorted attrs joined) */
function skuKey(attrs: Record<string, string>): string {
  return Object.keys(attrs)
    .sort()
    .map((k) => `${k}=${attrs[k]}`)
    .join("|");
}

export const handlers: FormConfig["handlers"] = {
  /**
   * generateSkus — x-reaction handler
   * Dependencies: { specs: "specs" }
   * Produces: array of { specAttrs, price, stock, status }
   *
   * Preserves existing SKU data (price/stock/status) when specs change,
   * only adding new combinations and removing stale ones.
   */
  generateSkus({ field, dependencies }) {
    const specs: Array<{ name: string; values: string[] }> | undefined = dependencies.specs;
    const currentSkus: Array<{
      specAttrs: Record<string, string>;
      price: number;
      stock: number;
      status: 0 | 1;
    }> = field.value() || [];

    // Build lookup of existing SKUs by their attribute key
    const existingMap = new Map<string, (typeof currentSkus)[number]>();
    for (const sku of currentSkus) {
      if (sku.specAttrs) {
        existingMap.set(skuKey(sku.specAttrs), sku);
      }
    }

    // Generate new cartesian product
    const combos = cartesian(specs || []);
    if (combos.length === 0) return [];

    // Map to SKU objects, preserving existing data
    return combos.map((attrs) => {
      const key = skuKey(attrs);
      const existing = existingMap.get(key);
      if (existing) {
        // Preserve price/stock/status, update specAttrs in case key order changed
        return { ...existing, specAttrs: attrs };
      }
      // New combination — default values
      return { specAttrs: attrs, price: 0, stock: 0, status: 1 as const };
    });
  },
};
