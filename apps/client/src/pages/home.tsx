import type { Component } from "solid-js";
import type { ActionContext } from "formwork";
import { modelSourceName } from "../models";

/** 提供默认模型、私域内容和完整模型工作台入口。 */
export const Home: Component<ActionContext> = (ctx) => (
  <div>
    <header class="page-header">
      <div>
        <div class="eyebrow">ALIEN FORM / FORMWORK</div>
        <h1>让模型成为工作界面</h1>
        <p class="muted">当前模型源：{modelSourceName} · 独立开发数据服务</p>
      </div>
    </header>
    <div class="home-grid">
      <button class="panel home-card" onClick={() => ctx.navigate("list", { domain: "orders" })}>
        <div class="eyebrow">DEFAULT MODEL</div>
        <h2>订单管理</h2>
        <p class="muted">筛选、分页与订单明细，使用默认字段能力。</p>
      </button>
      <button class="panel home-card" onClick={() => ctx.navigate("list", { domain: "cms" })}>
        <div class="eyebrow">DOMAIN OVERRIDE</div>
        <h2>内容管理</h2>
        <p class="muted">按需加载 cms 正文组件和模型校验。</p>
      </button>
      <button class="panel home-card" onClick={() => ctx.navigate("models")}>
        <div class="eyebrow">MODEL WORKBENCH</div>
        <h2>模型工作台</h2>
        <p class="muted">完整源、条件保存与实际页面预览。</p>
      </button>
    </div>
  </div>
);
