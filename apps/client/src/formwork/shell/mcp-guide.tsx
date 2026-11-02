import { createSignal, For, Show } from "solid-js";
import type { Component } from "solid-js";
import { toolDescriptions } from "formwork/mcp";
import { Icon } from "./icons";

const tools = Object.keys(toolDescriptions);

/** 在模型列表提供 HTTP/HTTPS MCP 地址和自定义 Headers 鉴权配置。 */
export const McpGuide: Component = () => {
  const [open, setOpen] = createSignal(false);
  const [feedback, setFeedback] = createSignal("");
  const apiUrl = new URL(
    import.meta.env.VITE_FORMWORK_API_URL ?? "/api/v1",
    window.location.origin,
  );
  const url = new URL("/mcp", apiUrl).href;
  const config = JSON.stringify(
    {
      mcpServers: {
        formwork: {
          url,
          headers: { Authorization: "Bearer <在 API token 页面签发的 agent token>" },
        },
      },
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
                <h3>获取地址和 token</h3>
                <p>在 API token 页面签发 agent token。</p>
                <p>
                  本地运行 <code>pnpm dev</code>；线上使用 Worker 的 HTTPS 地址。
                </p>
                <div class="mcp-command">
                  <code>{url}</code>
                </div>
              </div>
            </div>
            <div class="mcp-step">
              <span class="step-number">2</span>
              <div>
                <h3>添加 MCP 服务器</h3>
                <p>
                  选择 HTTP/HTTPS（Streamable HTTP）连接，将右侧配置添加到 AI 客户端的 MCP
                  设置，再启用 <code>formwork</code>。
                </p>
                <p>
                  在自定义 Headers 中添加 <code>Authorization</code>，值为{" "}
                  <code>Bearer &lt;agent token&gt;</code>。
                </p>
              </div>
            </div>
            <div class="mcp-step">
              <span class="step-number">3</span>
              <div>
                <h3>获取指南和组件，开始编辑</h3>
                <p>
                  让 AI 先调用 <code>{"formwork.describe({})"}</code> 获取模型模板和构建指南，
                  再调用 <code>{"formwork.capabilities({})"}</code> 查看全部组件和页面。
                  连接后即可开始，无需提供编辑器链接或项目上下文。
                </p>
                <p>
                  修改已有模型先调用 <code>models.read</code>；校验后保存， 用返回的{" "}
                  <code>revision</code> 作为 <code>ifRevision</code>。 新建模型传{" "}
                  <code>ifRevision: null</code>，草稿在管理页手动发布。
                </p>
              </div>
            </div>
            <Show when={!import.meta.env.DEV}>
              <p class="mcp-source-note">
                请确认 URL 指向实际 Worker 的 /mcp 端点，并将 Headers 中的占位值替换为 agent token。
              </p>
            </Show>
          </div>
          <div class="mcp-config">
            <div class="mcp-config-heading">
              <span>HTTP/HTTPS · 客户端配置</span>
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
