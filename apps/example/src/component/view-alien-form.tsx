import React, { useEffect, useState } from "react";
import { getProduct, getSchema } from "@/mock";
import { AlienForm } from "./alien-form";
import { IFormSchema } from "@alien-form/react";
import { FormItem } from "@alien-form/ui";

const Text = ({ value }: any) => (
  <div className="text-sm text-muted-foreground">{Array.isArray(value) ? JSON.stringify(value) : String(value ?? "-")}</div>
);

const readPrettyComponents = { Input: Text, Select: Text, Textarea: Text, Switch: Text };
const readPrettyDecorators = { FormItem };

export const ViewAlienForm: React.FC<{ id: string; onBack: () => void }> = ({ id, onBack }) => {
  const [schema, setSchema] = useState<IFormSchema | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSchema(), getProduct(id)]).then(([s, product]) => {
      setSchema(s);
      if (product) {
        setData({ specs: product.specs || [], skus: product.skus || [] });
      }
      setLoading(false);
    });
  }, [id]);

  if (loading || !schema) {
    return <PageShell title="商品详情" onBack={onBack}><LoadingState /></PageShell>;
  }

  if (!data) {
    return (
      <PageShell title="商品详情" onBack={onBack}>
        <div className="py-12 text-center text-muted-foreground">商品不存在</div>
      </PageShell>
    );
  }

  return (
    <PageShell title="商品详情" onBack={onBack}>
      <AlienForm
        data={data}
        schema={schema}
        components={readPrettyComponents}
        decorators={readPrettyDecorators}
      />
    </PageShell>
  );
};

function PageShell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      </div>
      {children}
    </div>
  );
}

function LoadingState() {
  return <div className="py-12 text-center text-muted-foreground">加载中…</div>;
}
