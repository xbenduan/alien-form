import type { FormConfig, FormInstance } from "@alien-form/react";

// ─── Cartesian Product Utility ───────────────────────────────────────────────

function cartesian(specs: Array<{ name: string; values: string[] }>): Record<string, string>[] {
  if (!specs || specs.length === 0) return [];
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

/** Stable key for SKU combination */
function skuKey(attrs: Record<string, string>): string {
  return Object.keys(attrs)
    .sort()
    .map((k) => )
    .join("|");
}

// ─── Setup: specs → skus linkage via form.effect ─────────────────────────────

/**
 * Use form.effect with a selector on form.values().specs to detect ANY change
 * in the specs tree (including child field edits like specs.0.values).
 *
 * form.values() is a computed signal that reads ALL child field value signals,
 * so when specs.0.values changes, form.values() recomputes, and our selector
 * picks up the new specs array.
 */
function setupSpecsToSkusLinkage(form: FormInstance): void {
  form.effect(
    // Selector: extract specs from computed values
    (f) => {
      const vals = f.values();
      return vals.specs as Array<{ name: string; values: string[] }> | undefined;
    },
    // Listener: fires when specs changes
    (specs) => {
      const skusField = form.field("skus");
      if (!skusField) return;

      const currentSkus: Array<{
        specAttrs: Record<string, string>;
        price: number;
        stock: number;
        status: 0 | 1;
      }> = skusField.value() || [];

      // Build lookup of existing SKUs
      const existingMap = new Map<string, (typeof currentSkus)[number]>();
      for (const sku of currentSkus) {
        if (sku.specAttrs) {
          existingMap.set(skuKey(sku.specAttrs), sku);
        }
      }

      // Generate cartesian product
      const combos = cartesian(specs || []);
      if (combos.length === 0) {
        skusField.setValue([]);
        return;
      }

      // Build new SKUs, preserving existing data
      const newSkus = combos.map((attrs) => {
        const key = skuKey(attrs);
        const existing = existingMap.get(key);
        if (existing) {
          return { ...existing, specAttrs: attrs };
        }
        return { specAttrs: attrs, price: 0, stock: 0, status: 1 as const };
      });

      skusField.setValue(newSkus);
    },
    { immediate: false, equals: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const handlers: FormConfig["handlers"] = {};

export const formSetup: FormConfig["setup"] = (form) => {
  setupSpecsToSkusLinkage(form);
};
