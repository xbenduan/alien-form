import { Navigate } from "@solidjs/router";
import type { Component } from "solid-js";
import type { ActionContext } from "formwork";

/** 将原首页入口转到模型工作台。 */
export const Home: Component<ActionContext> = () => <Navigate href="/models" />;
