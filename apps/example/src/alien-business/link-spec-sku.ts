import type { IForm } from "@alien-form/react";

/**
 * 规格 → SKU 笛卡尔积联动
 *
 * 监听 specs 字段的值变化，自动做笛卡尔积生成 skus 行。
 * 已有行按 skuKey 保留用户已填写的 price、stock、enabled 等数据。
 *
 * specs 数据结构:
 *   [{ name: "颜色", values: [{ label: "红" }, { label: "蓝" }] },
 *    { name: "尺码", values: [{ label: "S" }, { label: "M" }] }]
 *
 * 生成 skus:
 *   [{ skuKey: "红|S", specSummary: "颜色:红 / 尺码:S", price: ..., stock: ..., enabled: true },
 *    { skuKey: "红|M", specSummary: "颜色:红 / 尺码:M", ... },
 *    ...]
 */

interface SpecItem {
  name?: string;
  values?: Array<{ label?: string }>;
}

interface SkuRow {
  skuKey: string;
  specSummary: string;
  price?: number;
  stock?: number;
  enabled?: boolean;
  [key: string]: any;
}

/**
 * 笛卡尔积
 * cartesian([["红","蓝"],["S","M"]]) → [["红","S"],["红","M"],["蓝","S"],["蓝","M"]]
 */
function cartesian<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [];
  return arrays.reduce<T[][]>(
    (acc, arr) => acc.flatMap((combo) => arr.map((item) => [...combo, item])),
    [[]],
  );
}

export function linkSpecAndSku(form: IForm): void {
  const specsField = form.getField("specs");
  const skusField = form.getField("skus");
  if (!specsField || !skusField) return;

  const specs: SpecItem[] = Array.isArray(specsField.value) ? specsField.value : [];

  // 1. 收集有效的规格维度（有名称 + 至少一个非空值）
  const validSpecs = specs
    .filter((s) => s.name && Array.isArray(s.values) && s.values.length > 0)
    .map((s) => ({
      name: s.name!,
      values: s.values!.map((v) => v.label || "").filter((v) => v !== ""),
    }))
    .filter((s) => s.values.length > 0);

  // 2. 没有有效规格 → 清空 skus
  if (validSpecs.length === 0) {
    if (Array.isArray(skusField.value) && skusField.value.length > 0) {
      skusField.setValue([]);
    }
    return;
  }

  // 3. 笛卡尔积
  const valueArrays = validSpecs.map((s) => s.values);
  const combos = cartesian(valueArrays);

  // 4. 构建新 skuKey → 组合映射
  const newRows: SkuRow[] = combos.map((combo) => {
    const skuKey = combo.join("|");
    const specSummary = validSpecs
      .map((s, idx) => `${s.name}:${combo[idx]}`)
      .join(" / ");
    return { skuKey, specSummary, enabled: true };
  });

  // 5. 保留旧数据（按 skuKey 匹配）
  const oldRows: SkuRow[] = Array.isArray(skusField.value) ? skusField.value : [];
  const oldMap = new Map<string, SkuRow>();
  for (const row of oldRows) {
    if (row.skuKey) oldMap.set(row.skuKey, row);
  }

  const merged = newRows.map((row) => {
    const old = oldMap.get(row.skuKey);
    if (old) {
      return { ...old, specSummary: row.specSummary };
    }
    return row;
  });

  // 6. 只在内容变化时更新（避免无限循环）
  const currentKeys = oldRows.map((r) => r.skuKey).join(",");
  const newKeys = merged.map((r) => r.skuKey).join(",");
  if (currentKeys !== newKeys) {
    skusField.setValue(merged);
  }
}
