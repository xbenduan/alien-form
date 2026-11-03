import { Toast, toaster } from "@kobalte/core/toast";
import { createEffect, createSignal, onCleanup, Show, untrack } from "solid-js";
import type { Component } from "solid-js";
import { errorPayload } from "formwork/model";
import { Icon } from "../../formwork/shell/icons";

type MessageOptions = {
  description?: string;
  retry?: () => unknown;
  retryLabel?: string;
};
type MessageKind = "error" | "success" | "info";
const active = new Map<string, number>();
const subscribers = new Map<number, number>();

function dismiss(id: number) {
  for (const [key, value] of active) {
    if (value === id) active.delete(key);
  }
  toaster.dismiss(id);
}

function show(kind: MessageKind, text: string, options: MessageOptions = {}) {
  const key = `${kind}:${text}:${options.description ?? ""}`;
  const existing = active.get(key);
  if (existing !== undefined) return existing;
  const id = toaster.show((props) => {
    const [busy, setBusy] = createSignal(false);
    onCleanup(() => {
      if (active.get(key) === props.toastId) active.delete(key);
    });
    return (
      <Toast
        toastId={props.toastId}
        class={`message message-${kind}`}
        duration={kind === "error" ? 7000 : 4000}
        persistent={!!options.retry}
        priority={kind === "error" ? "high" : "low"}
      >
        <Icon name={kind === "success" ? "check" : "info"} />
        <div class="message-body">
          <Toast.Title>{text}</Toast.Title>
          <Show when={options.description}>
            <Toast.Description class="message-description">{options.description}</Toast.Description>
          </Show>
          <Show when={options.retry}>
            <button
              type="button"
              class="text-button"
              disabled={busy()}
              onClick={async () => {
                if (busy()) return;
                setBusy(true);
                try {
                  await options.retry?.();
                  dismiss(props.toastId);
                } catch (error) {
                  Message.error(error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy() ? "正在重试…" : (options.retryLabel ?? "重新加载")}
            </button>
          </Show>
        </div>
        <Toast.CloseButton class="icon-button" aria-label="关闭提示">
          <Icon name="close" />
        </Toast.CloseButton>
      </Toast>
    );
  });
  active.set(key, id);
  return id;
}

/**
 * 统一显示全局反馈，合并当前可见的相同消息，并忽略已取消的请求。
 * @example Message.error(error); Message.success("已保存");
 */
export const Message = {
  error(error: unknown, options: MessageOptions & { prefix?: string } = {}) {
    const payload = errorPayload(error);
    if (payload.code === "ABORTED") return;
    return show("error", `${options.prefix ?? ""}${payload.message}`, {
      ...options,
      description:
        options.description ??
        [
          ...(payload.issues ?? []).map((issue) => `${issue.path || "/"} · ${issue.message}`),
          ...(payload.currentRevision ? ["编辑内容已保留，请重新加载最新版本后合并修改。"] : []),
        ].join("\n"),
    });
  },
  success: (text: string) => show("success", text),
  info: (text: string) => show("info", text),
  dismiss,
};

/** 在每个浏览器文档挂载一次消息区域，弹窗内也可访问且不会抢占输入焦点。 */
export const MessageHost: Component = () => (
  <Toast.Region
    class="message-region"
    aria-label="全局提示（Alt+T）"
    limit={4}
    topLayer
    pauseOnInteraction
    pauseOnPageIdle
  >
    <Toast.List class="message-list" />
  </Toast.Region>
);

/**
 * 将响应式页面错误转为全局 Message，错误解除或页面卸载时清理提示。
 * @example <ErrorMessage error={resource.error} retry={refetch} />
 */
export const ErrorMessage: Component<MessageOptions & { error: unknown; prefix?: string }> = (
  props,
) => {
  createEffect(() => {
    const error = props.error;
    if (!error) return;
    const id = untrack(() =>
      Message.error(error, {
        prefix: props.prefix,
        retry: props.retry,
        retryLabel: props.retryLabel,
        description: props.description,
      }),
    );
    if (id !== undefined) subscribers.set(id, (subscribers.get(id) ?? 0) + 1);
    onCleanup(() => {
      if (id === undefined) return;
      const remaining = (subscribers.get(id) ?? 1) - 1;
      if (remaining > 0) subscribers.set(id, remaining);
      else {
        subscribers.delete(id);
        Message.dismiss(id);
      }
    });
  });
  return null;
};
