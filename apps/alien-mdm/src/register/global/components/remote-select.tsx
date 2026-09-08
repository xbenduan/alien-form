import { Select as AntSelect } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DataSourceItem } from "@alien-form/core";
import type { ListRequest } from "@app-types";
import type { ComponentProps } from "@alien-form/react";
import { DetailValue, buildProps } from "./shared";

interface OptionRequest extends ListRequest {
  valueField: string;
  labelField: string;
}

type OptionLoader = (request: OptionRequest) => Promise<DataSourceItem[]>;

interface ReferenceValue {
  $ref: string;
  value: unknown;
  label?: ReactNode;
}

function isReferenceValue(value: unknown): value is ReferenceValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Partial<ReferenceValue>).$ref === "string" &&
    "value" in value
  );
}

function selectedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(selectedValue);
  return isReferenceValue(value) ? value.value : value;
}

function optionKey(value: unknown): string {
  return `${typeof value}:${String(value)}`;
}

function mergeOptions(...groups: DataSourceItem[][]): DataSourceItem[] {
  const merged = new Map<string, DataSourceItem>();
  for (const option of groups.flat()) merged.set(optionKey(option.value), option);
  return [...merged.values()];
}

function referenceOptions(value: unknown): DataSourceItem[] {
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((item) =>
    isReferenceValue(item) ? [{ value: item.value, label: String(item.label ?? item.value) }] : [],
  );
}

export function RemoteSelect(
  props: ComponentProps & {
    model?: string;
    loadOptions?: OptionLoader;
    valueField?: string;
    labelField?: string;
    pageSize?: number;
    multiple?: boolean;
  },
) {
  const { mode, controlProps, value, onChange, loading, extraProps } = buildProps(props, [
    "model",
    "loadOptions",
    "valueField",
    "labelField",
    "pageSize",
    "multiple",
  ]);
  const {
    model,
    loadOptions,
    valueField = "id",
    labelField = "name",
    pageSize = 10,
    multiple = false,
  } = extraProps as {
    model?: string;
    loadOptions?: OptionLoader;
    valueField?: string;
    labelField?: string;
    pageSize?: number;
    multiple?: boolean;
  };
  const refs = useMemo(() => referenceOptions(value), [value]);
  const normalizedValue = useMemo(() => selectedValue(value), [value]);
  const [options, setOptions] = useState<DataSourceItem[]>(refs);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const cache = useRef(new Map<string, DataSourceItem[]>());
  const requestVersion = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    cache.current.clear();
    setOptions(refs);
    setLoadFailed(false);
  }, [labelField, model, pageSize, refs, valueField]);

  const load = useCallback(
    async (keyword?: string) => {
      if (!model || !loadOptions) return;
      const key = keyword ?? "";
      const cached = cache.current.get(key);
      if (cached) {
        setOptions(mergeOptions(refs, cached));
        return;
      }

      const version = ++requestVersion.current;
      setLoadFailed(false);
      setRemoteLoading(true);
      try {
        const loaded = await loadOptions({
          model,
          valueField,
          labelField,
          keyword: keyword || undefined,
          searchFields: [...new Set([valueField, labelField])],
          pagination: { current: 1, pageSize },
        });
        if (version !== requestVersion.current) return;
        cache.current.set(key, loaded);
        setOptions(mergeOptions(refs, loaded));
      } catch {
        if (version === requestVersion.current) setLoadFailed(true);
      } finally {
        if (version === requestVersion.current) setRemoteLoading(false);
      }
    },
    [labelField, loadOptions, model, pageSize, refs, valueField],
  );

  useEffect(
    () => () => {
      requestVersion.current += 1;
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const handleSearch = (keyword: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => void load(keyword.trim() || undefined), 250);
  };

  if (mode === "detail") {
    if (isReferenceValue(value)) return <DetailValue value={value.label ?? value.value} />;
    if (Array.isArray(value) && value.every(isReferenceValue)) {
      return <DetailValue value={value.map((item) => item.label ?? item.value).join(", ")} />;
    }
    const selected = options.filter((option) =>
      (Array.isArray(normalizedValue) ? normalizedValue : [normalizedValue]).some((item) =>
        Object.is(item, option.value),
      ),
    );
    return <DetailValue value={selected.map((option) => option.label).join(", ") || value} />;
  }

  return (
    <AntSelect
      {...controlProps}
      mode={multiple ? "multiple" : undefined}
      placeholder={(controlProps.placeholder as string | undefined) || "请输入关键词搜索"}
      allowClear
      showSearch={{ filterOption: false, onSearch: handleSearch }}
      style={{ width: "100%", ...(controlProps.style as object) }}
      value={normalizedValue as any}
      options={options}
      loading={Boolean(loading) || remoteLoading}
      notFoundContent={loadFailed ? "选项加载失败" : undefined}
      onOpenChange={(open) => {
        if (open) void load();
      }}
      onChange={(next) => onChange?.(next)}
    />
  );
}
