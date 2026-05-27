export interface SpecDraft {
  name?: string;
  supportsImage?: boolean;
  values?: Array<{
    label?: string;
    image?: string;
  }>;
}

export interface SkuDraft {
  skuKey?: string;
  groupKey?: string;
  groupSpecName?: string;
  groupSpecValue?: string;
  groupSpecImage?: string;
  specSummary?: string;
  price?: number;
  stock?: number;
  startDate?: string;
  endDate?: string;
  accessories?: string[];
  enabled?: boolean;
}

export type NormalizedSpec = {
  name: string;
  supportsImage: boolean;
  values: Array<{ label: string; image?: string }>;
};

export function createSkuDemoInitialValues() {
  const specs: SpecDraft[] = [];

  return {
    specs,
    skus: buildCartesianSpecRows(normalizeSpecs(specs), []),
  };
}

export function enforceSingleImageSpec(rawSpecs: unknown): {
  specs: SpecDraft[];
  changed: boolean;
} {
  if (!Array.isArray(rawSpecs)) return { specs: [], changed: false };

  const specs = rawSpecs.map((spec) => ({
    ...(spec as SpecDraft),
    values: Array.isArray((spec as SpecDraft)?.values)
      ? [...((spec as SpecDraft).values ?? [])]
      : [],
  }));

  const enabledIndexes = specs
    .map((spec, index) => (spec.supportsImage ? index : -1))
    .filter((index) => index >= 0);

  if (enabledIndexes.length <= 1) {
    return { specs, changed: false };
  }

  const winnerIndex = enabledIndexes[enabledIndexes.length - 1];
  return {
    specs: specs.map((spec, index) => ({
      ...spec,
      supportsImage: index === winnerIndex,
    })),
    changed: true,
  };
}

export function normalizeSpecs(rawSpecs: unknown): NormalizedSpec[] {
  if (!Array.isArray(rawSpecs)) return [];

  return rawSpecs
    .map((spec) => {
      const name = String((spec as SpecDraft)?.name ?? "").trim();
      const supportsImage = Boolean((spec as SpecDraft)?.supportsImage);
      const values = Array.isArray((spec as SpecDraft)?.values)
        ? (spec as SpecDraft)
            .values!.map((value) => ({
              label: String(value?.label ?? "").trim(),
              image: String(value?.image ?? "").trim(),
            }))
            .filter((value) => value.label)
            .filter(
              (value, index, array) =>
                array.findIndex((item) => item.label === value.label) === index,
            )
        : [];

      return { name, supportsImage, values };
    })
    .filter((spec) => spec.name && spec.values.length > 0);
}

export function buildCartesianSpecRows(
  specs: NormalizedSpec[],
  previousRows: SkuDraft[],
): SkuDraft[] {
  if (specs.length === 0) return [];

  const groupSpec = specs.find((spec) => spec.supportsImage);
  const combinations = specs.reduce<
    Array<Array<{ name: string; label: string; image?: string; supportsImage: boolean }>>
  >((accumulator, spec) => {
    if (accumulator.length === 0) {
      return spec.values.map((value) => [
        {
          name: spec.name,
          label: value.label,
          image: value.image,
          supportsImage: spec.supportsImage,
        },
      ]);
    }

    return accumulator.flatMap((combination) =>
      spec.values.map((value) => [
        ...combination,
        {
          name: spec.name,
          label: value.label,
          image: value.image,
          supportsImage: spec.supportsImage,
        },
      ]),
    );
  }, []);

  const previousMap = new Map(
    previousRows.filter((row) => row?.skuKey).map((row) => [row.skuKey as string, row]),
  );

  return combinations.map((combination) => {
    const skuKey = combination.map((item) => `${item.name}=${item.label}`).join("|");
    const previous = previousMap.get(skuKey);
    const groupedItem = groupSpec
      ? combination.find((item) => item.name === groupSpec.name)
      : undefined;
    const salesSpecItems = groupedItem
      ? combination.filter((item) => item.name !== groupSpec?.name)
      : combination;
    const specSummary = salesSpecItems.length
      ? salesSpecItems.map((item) => `${item.name}: ${item.label}`).join(" / ")
      : "默认销售配置";

    return {
      skuKey,
      groupKey: groupedItem?.label ?? "",
      groupSpecName: groupedItem?.name ?? "",
      groupSpecValue: groupedItem?.label ?? "",
      groupSpecImage: groupedItem?.image ?? "",
      specSummary,
      price: previous?.price,
      stock: previous?.stock ?? 0,
      startDate: previous?.startDate ?? "",
      endDate: previous?.endDate ?? "",
      accessories: Array.isArray(previous?.accessories) ? previous?.accessories : [],
      enabled: previous?.enabled ?? true,
    };
  });
}

export function areSkuRowsEqual(a: SkuDraft[], b: SkuDraft[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
