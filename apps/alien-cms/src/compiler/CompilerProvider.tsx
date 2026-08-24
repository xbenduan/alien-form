import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import {
  FieldServiceContext,
  RuntimeResourceContext,
  type SchemaCompiler,
} from "@alien-form/shared";
import { createAppCompiler } from "./create-compiler";
import { RuntimeCore } from "../runtime";

const CompilerContext = createContext<SchemaCompiler | null>(null);

/**
 * 每个 domain 挂一个 CompilerProvider：new 一个 SchemaCompiler 实例，
 * locale 变化时重建（useMemo 依赖 locale），Provider 卸载即随组件树销毁。
 * 同时把当前 domain 的 service resolver 灌入 FieldServiceContext，向消费
 * dataSource 的组件提供 records.list。
 */
export function CompilerProvider({
  locale = "zh",
  domain,
  children,
}: {
  locale?: string;
  domain?: string;
  children: ReactNode;
}) {
  const compiler = useMemo(() => createAppCompiler(locale, domain), [locale, domain]);
  return (
    <CompilerContext.Provider value={compiler}>
      <RuntimeResourceContext.Provider value={RuntimeCore.current.resources(domain)}>
        <FieldServiceContext.Provider
          value={(code) => RuntimeCore.current.service.query(code, domain)}
        >
          {children}
        </FieldServiceContext.Provider>
      </RuntimeResourceContext.Provider>
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
