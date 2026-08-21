import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { FieldServiceContext, type SchemaCompiler } from "@alien-form/shared";
import { appRequest, createAppCompiler } from "./create-compiler";

const CompilerContext = createContext<SchemaCompiler | null>(null);

/**
 * 每个 domain 挂一个 CompilerProvider：new 一个 SchemaCompiler 实例，
 * locale 变化时重建（useMemo 依赖 locale），Provider 卸载即随组件树销毁。
 * 同时把 appRequest 灌入 FieldServiceContext，向消费 dataSource 的组件注入
 * request（props 方案自取）。
 */
export function CompilerProvider({
  locale = "zh",
  children,
}: {
  locale?: string;
  children: ReactNode;
}) {
  const compiler = useMemo(() => createAppCompiler(locale), [locale]);
  return (
    <CompilerContext.Provider value={compiler}>
      <FieldServiceContext.Provider value={appRequest}>{children}</FieldServiceContext.Provider>
    </CompilerContext.Provider>
  );
}

/** 取当前 domain 的 SchemaCompiler 实例。 */
export function useCompiler(): SchemaCompiler {
  const compiler = useContext(CompilerContext);
  if (!compiler) {
    throw new Error("[alien-cms] useCompiler 必须在 <CompilerProvider> 内使用");
  }
  return compiler;
}
