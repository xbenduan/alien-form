import type { FormConfig } from "@alien-form/react";

function cartesian(specs: Array<{ name: string; values: string[] }>): Record<string, string>[] {
  if (!specs || specs.length === 0) return [];
  const valid = specs.filter((s) => s.name && s.values && s.values.length > 0);
  if (valid.length === 0) return [];

  return valid.reduce<Record<string, string>[]>((acc, spec) => {
    const result: Record<string, string>[] = [];
    for (const combo of acc) {
      for (const val of spec.values) result.push({ ...combo, [spec.name]: val });
    }
    return result;
  }, [{}]);
}

function skuKey(attrs: Record<string, string>): string {
  return Object.keys(attrs).sort().map((k) => `${k}=${attrs[k]}`).join("|");
}

export const handlers: FormConfig["handlers"] = {
  syncSkus(ctx) {
    return ctx.effect(() => {
      const specs = ctx.get("specs") as Array<{ name: string; values: string[] }> | undefined;
      const skus = ctx.project("skus") as Array<{
        specAttrs: Record<string, string>;
        price: number;
        stock: number;
        status: 0 | 1;
      }> | undefined;
      const skusField = ctx.form.field("skus");
      if (!skusField || skusField.kind !== "array") return;

      const existingMap = new Map<string, NonNullable<typeof skus>[number]>();
      for (const sku of skus || []) {
        if (sku.specAttrs) existingMap.set(skuKey(sku.specAttrs), sku);
      }

      const combos = cartesian(specs || []);
      if (combos.length === 0) {
        skusField.setRows([]);
        return;
      }

      skusField.setRows(combos.map((attrs) => {
        const existing = existingMap.get(skuKey(attrs));
        return existing ? { ...existing, specAttrs: attrs } : { specAttrs: attrs, price: 0, stock: 0, status: 1 as const };
      }));
    });
  },
};
