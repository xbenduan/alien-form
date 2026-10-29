import { createSignal, For, Show } from "solid-js";
import type { Component } from "solid-js";
import { modelSourceName } from "../models";
import { Icon } from "./icons";

const tools = [
  "models.list",
  "models.read",
  "formwork.capabilities",
  "models.validate",
  "models.write",
  "models.preview",
];

/** 在模型工作台提供与当前开发服务匹配的 stdio MCP 配置和接入步骤。 */
export const McpGuide: Component = () => {
  const [open, setOpen] = createSignal(false);
  const [feedback, setFeedback] = createSignal("");
  const origin = window.location.origin;
  const entry =
    import.meta.env.VITE_FORMWORK_MCP_ENTRY ?? "<项目绝对路径>/packages/formwork/dist/stdio.js";
  const config = JSON.stringify(
    {
      mcpServers: { formwork: { command: "node", args: [entry, "--url", origin] } },
    },
    null,
    2,
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(config);
      setFeedback("配置已复制");
    } catch {
      setFeedback("复制失败，请选中配置手动复制");
    }
  };
  return (
    <section class="mcp-guide panel" aria-label="MCP 接入">
      <button
        type="button"
        class="mcp-toggle"
        aria-expanded={open()}
        aria-controls="mcp-instructions"
        onClick={() => setOpen(!open())}
      >
        <Icon name="code" />
        <span>MCP 接入</span>
        <span class="mcp-summary">连接 AI 客户端编辑模型</span>
        <Icon name="chevron" class="mcp-chevron" />
      </button>
      <Show when={open()}>
        <div id="mcp-instructions" class="mcp-instructions">
          <div class="mcp-steps">
            <div class="mcp-step">
              <span class="step-number">1</span>
              <div>
                <h3>保持开发服务运行</h3>
                <p>
                  在项目根目录执行 <code>pnpm dev</code>。MCP 通过 stdio 连接 Vite 的本地模型源。
                </p>
                <div class="mcp-command">
                  <code>pnpm mcp --url {origin}</code>
                </div>
              </div>
            </div>
            <div class="mcp-step">
              <span class="step-number">2</span>
              <div>
                <h3>添加 MCP 服务器</h3>
                <p>
                  将右侧配置添加到 AI 客户端的 MCP 设置，再启用 <code>formwork</code>。
                </p>
                <p>
                  项目使用 Node 26.13.0；可将 <code>command</code> 改为对应 Node 的绝对路径。
                </p>
              </div>
            </div>
            <div class="mcp-step">
              <span class="step-number">3</span>
              <div>
                <h3>读取、校验并保存模型</h3>
                <p>
                  先调用 <code>models.read</code>，保存时传入返回的 <code>revision</code> 作为{" "}
                  <code>ifRevision</code>，再预览结果。
                </p>
              </div>
            </div>
            <Show when={modelSourceName === "remote"}>
              <p class="mcp-source-note">
                当前界面使用远端模型源。MCP
                编辑本地文件模型，需在本地来源界面执行“上传到远端”后同步到远端。
              </p>
            </Show>
            <Show when={!import.meta.env.DEV}>
              <p class="mcp-source-note">
                当前为静态构建。请启动项目的 Vite 开发服务，并将配置中的项目路径与 URL 改为实际值。
              </p>
            </Show>
          </div>
          <div class="mcp-config">
            <div class="mcp-config-heading">
              <span>stdio · 客户端配置</span>
              <button type="button" class="text-button" onClick={copy}>
                <Icon name="code" />
                复制配置
              </button>
            </div>
            <pre aria-label="MCP 客户端配置">
              <code>{config}</code>
            </pre>
            <p class="mcp-feedback" aria-live="polite">
              {feedback()}
            </p>
          </div>
          <div class="mcp-tools">
            <span>可用工具</span>
            <For each={tools}>{(tool) => <code>{tool}</code>}</For>
          </div>
        </div>
      </Show>
    </section>
  );
};
