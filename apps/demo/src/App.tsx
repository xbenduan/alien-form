import React, { useState, useMemo } from "react";
import { useSchema } from "./useSchema";
import { SchemaList } from "./components/schema-list";
import { SchemaRenderer } from "./components/schema-renderer";

export const App: React.FC = () => {
  const schemas = useSchema();
  const [selectedId, setSelectedId] = useState(schemas[0].id);

  const selectedSchema = useMemo(
    () => schemas.find((s) => s.id === selectedId) || schemas[0],
    [schemas, selectedId],
  );

  return (
    <div className="flex h-screen">
      {/* Left panel — curated schema learning path */}
      <aside className="w-80 shrink-0 border-r bg-card">
        <SchemaList schemas={schemas} selectedId={selectedId} onSelect={setSelectedId} />
      </aside>

      {/* Right panel — Renderer */}
      <main className="flex-1 overflow-auto bg-muted/20 p-6">
        <div className="mx-auto max-w-5xl">
          <SchemaRenderer key={selectedId} schema={selectedSchema} />
        </div>
      </main>
    </div>
  );
};
