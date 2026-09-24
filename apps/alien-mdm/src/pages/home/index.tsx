import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClockCircleOutlined,
  DatabaseOutlined,
  EditOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
} from "@ant-design/icons";
import { Alert, Button, Empty, Input, Skeleton, Tabs, Tooltip, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import type { ModelRecord, ModelSummary } from "@app-types";
import { sdkClient } from "@runtime/sdk-client";
import { canManageModels } from "@runtime/user-info";

type GroupFilter = string;

interface ModelCategoryRecord extends ModelRecord {
  code?: string;
  name?: string;
  aggregate?: boolean;
  order?: number;
}

const FAVORITE_MODELS_KEY = "alien-mdm:favorite-models:v1";
const UPDATED_AT_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
});

function readFavoriteModelNames(): string[] {
  try {
    if (typeof window === "undefined") return [];
    const value = localStorage.getItem(FAVORITE_MODELS_KEY);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function writeFavoriteModelNames(names: string[]): void {
  try {
    localStorage.setItem(FAVORITE_MODELS_KEY, JSON.stringify(names));
  } catch {
    // Favorites are an enhancement and must not block model access.
  }
}

function formatUpdatedAt(value?: string): string {
  if (!value) return "内置";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "更新时间未知";
  return `${UPDATED_AT_FORMATTER.format(date)} 更新`;
}

function ModelIcon({ model }: { model: ModelSummary }) {
  const isSystem = model.system === true;
  return (
    <span
      className={`grid h-[42px] w-[42px] flex-[0_0_42px] place-items-center rounded-[7px] text-xl ${
        isSystem ? "bg-[#edf5ff] text-[#1769e0]" : "bg-[#eaf8f2] text-[#138a68]"
      }`}
    >
      {isSystem ? <SafetyCertificateOutlined /> : <DatabaseOutlined />}
    </span>
  );
}

function CardActions({
  model,
  favorite,
  onToggleFavorite,
  onEdit,
  compact = false,
}: {
  model: ModelSummary;
  favorite: boolean;
  onToggleFavorite: (model: ModelSummary) => void;
  onEdit?: (model: ModelSummary) => void;
  compact?: boolean;
}) {
  return (
    <>
      {onEdit ? (
        <Tooltip title="编辑模型">
          <Button
            type="text"
            shape="circle"
            className={`!absolute z-[1] !text-[#7b8799] hover:!text-[#1769e0] ${
              compact ? "!right-[35px] !top-[7px]" : "!right-[41px] !top-[9px]"
            }`}
            icon={<EditOutlined />}
            aria-label={`编辑${model.title}`}
            onClick={(event) => {
              event.stopPropagation();
              onEdit(model);
            }}
          />
        </Tooltip>
      ) : null}
      <Tooltip title={favorite ? "取消收藏" : "收藏"}>
        <Button
          type="text"
          shape="circle"
          className={`!absolute z-[1] !text-[#a1aab8] hover:!text-[#e49b0f] ${
            compact ? "!right-[7px] !top-[7px]" : "!right-[9px] !top-[9px]"
          } ${favorite ? "!text-[#e49b0f]" : ""}`}
          icon={favorite ? <StarFilled /> : <StarOutlined />}
          aria-label={favorite ? `取消收藏${model.title}` : `收藏${model.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(model);
          }}
        />
      </Tooltip>
    </>
  );
}

function ModelCard({
  model,
  onOpen,
  favorite,
  onToggleFavorite,
  onEdit,
  groupLabel,
}: {
  model: ModelSummary;
  onOpen: (model: ModelSummary) => void;
  favorite: boolean;
  onToggleFavorite: (model: ModelSummary) => void;
  onEdit?: (model: ModelSummary) => void;
  groupLabel?: string;
}) {
  const isSystem = model.system === true;
  const description = model.description || model.subtitle || model.name;

  return (
    <article className="relative cursor-pointer overflow-hidden rounded-lg border border-[#dfe6ee] bg-[var(--app-surface,rgba(255,255,255,0.72))] text-left text-[#172033] transition-[border-color,box-shadow,background-color] duration-160 hover:border-[#8eb9ee] hover:bg-[var(--app-surface-strong,rgba(255,255,255,0.88))] hover:shadow-[0_8px_20px_rgba(32,67,105,0.08)] focus-within:border-[#8eb9ee] focus-within:bg-[var(--app-surface-strong,rgba(255,255,255,0.88))] focus-within:shadow-[0_8px_20px_rgba(32,67,105,0.08)]">
      <button
        type="button"
        className="flex min-h-[118px] w-full items-start gap-3.5 border-0 bg-transparent p-4 text-left text-inherit"
        onClick={() => onOpen(model)}
      >
        <ModelIcon model={model} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 pr-6">
          <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-semibold text-[#172033]">
            {model.title}
          </strong>
          <Tooltip title={description}>
            <span className="mt-0.5 line-clamp-1 min-h-5 overflow-hidden text-[13px] leading-5 text-[#7b8799]">
              {description}
            </span>
          </Tooltip>
          <span className="mt-2 flex items-center gap-2 whitespace-nowrap text-xs text-[#8b96a7]">
            <span
              className={`inline-flex h-[22px] items-center rounded px-[7px] font-medium ${
                isSystem ? "bg-[#edf5ff] text-[#1769e0]" : "bg-[#eaf8f2] text-[#13795b]"
              }`}
            >
              {groupLabel ?? model.group ?? "未分类"}
            </span>
            <span>{model.fieldCount} 个字段</span>
            <span className="ml-auto inline-flex min-w-0 items-center gap-1 overflow-hidden text-ellipsis">
              <ClockCircleOutlined />
              {formatUpdatedAt(model.updatedAt)}
            </span>
          </span>
        </span>
      </button>
      <CardActions
        model={model}
        favorite={favorite}
        onToggleFavorite={onToggleFavorite}
        onEdit={onEdit}
      />
    </article>
  );
}

function FavoriteModelCard({
  model,
  onOpen,
  onToggleFavorite,
  onEdit,
}: {
  model: ModelSummary;
  onOpen: (model: ModelSummary) => void;
  onToggleFavorite: (model: ModelSummary) => void;
  onEdit?: (model: ModelSummary) => void;
}) {
  const description = model.description || model.subtitle || model.name;

  return (
    <article className="relative cursor-pointer overflow-hidden rounded-lg border border-[rgba(226,206,190,0.8)] bg-[rgba(255,255,255,0.72)] text-left text-[#172033] transition-[border-color,box-shadow,background-color] duration-160 hover:border-[#8eb9ee] hover:bg-[var(--app-surface-strong,rgba(255,255,255,0.88))] hover:shadow-[0_8px_20px_rgba(32,67,105,0.08)] focus-within:border-[#8eb9ee] focus-within:bg-[var(--app-surface-strong,rgba(255,255,255,0.88))] focus-within:shadow-[0_8px_20px_rgba(32,67,105,0.08)]">
      <button
        type="button"
        className="flex min-h-[82px] w-full items-center gap-2 border-0 bg-transparent p-[11px_12px] text-left text-inherit"
        onClick={() => onOpen(model)}
      >
        <ModelIcon model={model} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 pr-10">
          <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-semibold text-[#172033]">
            {model.title}
          </strong>
          <Tooltip title={description}>
            <span className="mt-px line-clamp-1 min-h-5 overflow-hidden text-xs leading-[18px] text-[#7b8799]">
              {description}
            </span>
          </Tooltip>
        </span>
      </button>
      <CardActions
        model={model}
        favorite
        onToggleFavorite={onToggleFavorite}
        onEdit={onEdit}
        compact
      />
    </article>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const canManage = canManageModels();
  const [models, setModels] = useState<ModelSummary[]>();
  const [modelCategories, setModelCategories] = useState<ModelCategoryRecord[]>([]);
  const [error, setError] = useState<string>();
  const [keyword, setKeyword] = useState("");
  const [group, setGroup] = useState<GroupFilter>("all");
  const [favoriteModelNames, setFavoriteModelNames] = useState(readFavoriteModelNames);

  useEffect(() => {
    void Promise.all([
      sdkClient.models.list(),
      sdkClient.collection<ModelCategoryRecord>("_sys_model_category").getList(1, 100),
    ])
      .then(([nextModels, categories]) => {
        setModels(nextModels);
        setModelCategories(
          (categories.list as ModelCategoryRecord[]).toSorted(
            (left, right) => (left.order ?? 0) - (right.order ?? 0),
          ),
        );
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  const groupLabels = useMemo(
    () =>
      new Map(
        modelCategories.flatMap((category) =>
          typeof category.code === "string" && typeof category.name === "string"
            ? [[category.code, category.name] as const]
            : [],
        ),
      ),
    [modelCategories],
  );

  const groupTabs = useMemo(
    () =>
      modelCategories.flatMap((category) =>
        typeof category.code === "string" && typeof category.name === "string"
          ? [{ key: category.code, label: category.name }]
          : [],
      ),
    [modelCategories],
  );

  const favoriteModels = useMemo(() => {
    if (!models?.length || !favoriteModelNames.length) return [];
    const modelsByName = new Map(models.map((model) => [model.name, model]));
    return favoriteModelNames.flatMap((name) => {
      const model = modelsByName.get(name);
      return model ? [model] : [];
    });
  }, [favoriteModelNames, models]);

  const favoriteModelNameSet = useMemo(() => new Set(favoriteModelNames), [favoriteModelNames]);

  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return (models ?? []).filter((model) => {
      const selected = modelCategories.find((category) => category.code === group);
      if (selected?.aggregate !== true && (model.group ?? "other") !== group) return false;
      if (!normalized) return true;
      return [model.name, model.title, model.subtitle, model.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [group, keyword, modelCategories, models]);

  const openModel = useCallback(
    (model: ModelSummary) => {
      navigate(`/records/${model.name}/list`);
    },
    [navigate],
  );
  const editModel = useCallback(
    (model: ModelSummary) => navigate(`/models/${model.name}/edit`),
    [navigate],
  );

  const toggleFavorite = useCallback(
    (model: ModelSummary) => {
      const next = favoriteModelNameSet.has(model.name)
        ? favoriteModelNames.filter((name) => name !== model.name)
        : [...favoriteModelNames, model.name];
      writeFavoriteModelNames(next);
      setFavoriteModelNames(next);
    },
    [favoriteModelNameSet, favoriteModelNames],
  );

  return (
    <div className="w-full pb-16">
      {error ? (
        <Alert type="error" title="模型列表加载失败" description={error} showIcon />
      ) : !models ? (
        <section
          className="grid grid-cols-4 gap-3.5 max-[640px]:grid-cols-1 min-[641px]:max-[1100px]:grid-cols-2"
          aria-label="正在加载模型"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div
              className="min-h-[118px] rounded-lg border border-[#dfe6ee] bg-[var(--app-surface,rgba(255,255,255,0.72))] p-5 backdrop-blur-[12px]"
              key={index}
            >
              <Skeleton active avatar paragraph={{ rows: 2 }} title={{ width: "45%" }} />
            </div>
          ))}
        </section>
      ) : (
        <>
          {favoriteModels.length > 0 ? (
            <section
              className="mb-7 rounded-xl border border-white/50 bg-white/42 p-[18px] shadow-[0_4px_14px_rgba(77,93,131,0.035)] backdrop-blur-[14px] max-[640px]:p-3.5"
              aria-labelledby="favorite-models-title"
            >
              <div className="mb-3 flex min-h-10 items-end justify-between gap-6 max-[640px]:flex-col max-[640px]:items-stretch max-[640px]:gap-3">
                <div>
                  <Typography.Title
                    level={2}
                    id="favorite-models-title"
                    className="!mb-0.5 !mt-0 !block text-lg leading-[1.4] !text-[#172033]"
                  >
                    收藏模型
                  </Typography.Title>
                  <Typography.Text className="!block text-xs !text-[#7b8799]">
                    固定常用的数据入口
                  </Typography.Text>
                </div>
              </div>
              <div className="grid grid-cols-6 gap-2.5 max-[640px]:grid-cols-1 min-[641px]:max-[1100px]:grid-cols-3 min-[1101px]:max-[1280px]:grid-cols-5">
                {favoriteModels.map((model) => (
                  <FavoriteModelCard
                    key={model.name}
                    model={model}
                    onOpen={openModel}
                    onToggleFavorite={toggleFavorite}
                    onEdit={canManage ? editModel : undefined}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section aria-label="全部模型">
            <div className="mb-6 flex min-h-14 items-center justify-between gap-3 max-[640px]:mb-[18px] max-[640px]:flex-col max-[640px]:items-stretch max-[640px]:gap-2">
              <Tabs
                className="w-full [&_.ant-tabs-nav]:m-0"
                size="large"
                activeKey={group}
                items={groupTabs}
                onChange={(key) => setGroup(key as GroupFilter)}
                tabBarExtraContent={
                  <div className="flex items-center gap-3 max-[640px]:justify-between">
                    <span className="whitespace-nowrap text-[13px] text-[#7b8799]">
                      {filtered.length} 个模型
                    </span>
                    <Input
                      size="large"
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder="搜索模型名称、标题或描述"
                      value={keyword}
                      onChange={(event) => setKeyword(event.target.value)}
                    />
                  </div>
                }
              />
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#d7dee8] bg-white/65 px-6 py-16">
                <Empty description={keyword ? "没有匹配的模型" : "还没有可用模型"} />
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3.5 max-[640px]:grid-cols-1 min-[641px]:max-[1100px]:grid-cols-2">
                {filtered.map((model) => (
                  <ModelCard
                    key={model.name}
                    model={model}
                    favorite={favoriteModelNameSet.has(model.name)}
                    onOpen={openModel}
                    onToggleFavorite={toggleFavorite}
                    onEdit={canManage ? editModel : undefined}
                    groupLabel={
                      model.group ? (groupLabels.get(model.group) ?? model.group) : "未分类"
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
