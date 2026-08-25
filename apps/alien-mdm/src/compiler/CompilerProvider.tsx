import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { SchemaCompiler } from "./shared";
import { createAppCompiler } from "./create-compiler";

const CompilerContext = createContext<SchemaCompiler | null>(null);

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
  return <CompilerContext.Provider value={compiler}>{children}</CompilerContext.Provider>;
}

export function useCompiler(): SchemaCompiler {
  const compiler = useContext(CompilerContext);
  if (!compiler) {
    throw new Error("[alien-mdm] useCompiler must be used within <CompilerProvider>");
  }
  return compiler;
}
