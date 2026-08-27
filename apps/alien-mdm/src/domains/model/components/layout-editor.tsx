import { useEffect, useState } from "react";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Alert, Button, Input, Select, Space, Typography } from "antd";
import { useBuilder, useBuilderAtom } from "@alien-form/builder/react";
import type { UiNode } from "@alien-form/engine";
import { FieldsetCard } from "@components";
import type { UiComponentDefinition } from "@app-types/shared";
import type { ModelDraft } from "../builder";
import styles from "./index.module.css";

type Definitions = Record<string, UiComponentDefinition>;
type ComponentOption = { value: string; label: string };

interface LayoutNodeEditorProps {
  definitions: Definitions;
  node: UiNode;
  root?: boolean;
  title?: string;
  onChange: (node: UiNode) => void;
  componentOptions?: ComponentOption[];
}

function optionsOf(definitions: Definitions): ComponentOption[] {
  return Object.values(definitions).map((definition) => ({
    value: definition.code,
    label: definition.title,
  }));
}

function JsonPropsEditor({
  value,
  rows,
  onChange,
}: {
  value?: Record<string, unknown>;
  rows: number;
  onChange: (value: Record<string, unknown> | undefined) => void;
}) {
  const [text, setText] = useState(value ? JSON.stringify(value, null, 2) : "");
  const [error, setError] = useState("");

  useEffect(() => {
    setText(value ? JSON.stringify(value, null, 2) : "");
    setError("");
  }, [value]);

  const apply = () => {
    if (!text.trim()) {
      onChange(undefined);
      setError("");
      return;
    }
    try {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setError("props 必须是 JSON 对象");
        return;
      }
      onChange(parsed as Record<string, unknown>);
      setError("");
    } catch {
      setError("请输入合法的 JSON");
    }
  };

  return (
    <label className={styles.layoutJson}>
      <span>props</span>
      <Input.TextArea
        rows={rows}
        value={text}
        spellCheck={false}
        status={error ? "error" : undefined}
        onChange={(event) => setText(event.target.value)}
        onBlur={apply}
      />
      {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
    </label>
  );
}

function moveNode(nodes: UiNode[], from: number, to: number): UiNode[] {
  const next = [...nodes];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

function NodeCollection({
  definitions,
  parent,
  nodes,
  onChange,
}: {
  definitions: Definitions;
  parent: string;
  nodes: UiNode[];
  onChange: (nodes: UiNode[]) => void;
}) {
  const componentOptions = optionsOf(definitions).filter(
    ({ value }) => definitions[value]?.authoring.parent === parent,
  );
  return (
    <FieldsetCard title="children">
      <div className={styles.layoutCollection}>
        {nodes.length ? (
          <div className={styles.layoutArrayCards}>
            {nodes.map((child, index) => (
              <div className={styles.layoutArrayCard} key={`${child.component}-${index}`}>
                <div className={styles.layoutArrayCardHeader}>
                  <span className={styles.layoutArrayCardIndex}>#{index + 1}</span>
                  <Space size={0}>
                    <Button
                      type="text"
                      icon={<ArrowUpOutlined />}
                      disabled={index === 0}
                      aria-label="上移节点"
                      onClick={() => index > 0 && onChange(moveNode(nodes, index, index - 1))}
                    />
                    <Button
                      type="text"
                      icon={<ArrowDownOutlined />}
                      disabled={index === nodes.length - 1}
                      aria-label="下移节点"
                      onClick={() =>
                        index < nodes.length - 1 && onChange(moveNode(nodes, index, index + 1))
                      }
                    />
                    <Button
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      aria-label="删除节点"
                      onClick={() => onChange(nodes.filter((_, itemIndex) => itemIndex !== index))}
                    />
                  </Space>
                </div>
                <div className={styles.layoutArrayCardBody}>
                  <LayoutNodeEditor
                    definitions={definitions}
                    node={child}
                    componentOptions={componentOptions}
                    onChange={(next) =>
                      onChange(nodes.map((item, itemIndex) => (itemIndex === index ? next : item)))
                    }
                  />
                </div>
              </div>
            ))}
            <Button
              className={styles.layoutArrayCardAdd}
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => onChange([...nodes, { component: "" }])}
            >
              添加节点
            </Button>
          </div>
        ) : (
          <div className={styles.layoutArrayCardsEmpty}>
            <span className={styles.muted}>暂无节点</span>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => onChange([{ component: "" }])}
            >
              添加节点
            </Button>
          </div>
        )}
      </div>
    </FieldsetCard>
  );
}

function LayoutNodeEditor({
  definitions,
  node,
  root,
  title,
  onChange,
  componentOptions,
}: LayoutNodeEditorProps) {
  const definition = definitions[node.component];
  if (node.component && !definition) {
    return <Alert type="error" message={`未注册布局组件：${node.component}`} />;
  }
  const allOptions = optionsOf(definitions);
  const availableOptions = root
    ? allOptions.filter(({ value }) => !definitions[value]?.authoring.parent)
    : (componentOptions ?? allOptions);

  const changeComponent = (component: string) => {
    const nextDefinition = definitions[component];
    const allowedSlots = new Set(nextDefinition?.slots ?? []);
    const slots = Object.fromEntries(
      Object.entries(node.slots ?? {}).filter(([name]) => allowedSlots.has(name)),
    );
    onChange({
      ...node,
      component,
      children: nextDefinition?.authoring.children ? node.children : undefined,
      slots: Object.keys(slots).length ? slots : undefined,
    });
  };

  return (
    <FieldsetCard title={title ?? definition?.title ?? "选择组件"}>
      <div className={styles.layoutNode}>
        <div className={styles.layoutNodeHeader}>
          <Select value={node.component} options={availableOptions} onChange={changeComponent} />
        </div>
        {definition && definition.authoring.props.show !== false ? (
          <JsonPropsEditor
            value={node.props}
            rows={definition.authoring.props.rows}
            onChange={(props) => onChange({ ...node, props })}
          />
        ) : null}
        {definition?.authoring.children ? (
          <NodeCollection
            definitions={definitions}
            parent={node.component}
            nodes={node.children ?? []}
            onChange={(children) =>
              onChange({ ...node, children: children.length ? children : undefined })
            }
          />
        ) : null}
        {(definition?.slots ?? []).map((slot) => {
          const slotOptions = allOptions.filter(
            ({ value }) => definitions[value]?.authoring.parent === node.component,
          );
          return (
            <LayoutNodeEditor
              key={slot}
              definitions={definitions}
              title={`slot · ${slot}`}
              node={node.slots?.[slot] ?? { component: "" }}
              componentOptions={slotOptions}
              onChange={(next) => onChange({ ...node, slots: { ...node.slots, [slot]: next } })}
            />
          );
        })}
      </div>
    </FieldsetCard>
  );
}

export function LayoutEditor() {
  const builder = useBuilder<ModelDraft>();
  const layout = useBuilderAtom(builder.document).layout;
  const definitions = builder.registry.ui.all(builder.domain) as Definitions;
  return (
    <LayoutNodeEditor
      root
      definitions={definitions}
      node={layout}
      onChange={(next) => builder.dispatch("layout.update", next)}
    />
  );
}
