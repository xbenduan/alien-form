import { Navigate } from "@solidjs/router";
import type { Component } from "solid-js";
import type { PageContext } from "formwork";

/** 将原首页入口转到模型列表。 */
export const Home: Component<PageContext> = () => <Navigate href="/models" />;
