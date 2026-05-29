import React, { useState } from "react";
import { Typography } from "antd";
import { GoodsList } from "./pages/goods-list";
import { GoodsForm } from "./pages/goods-form";
import { GoodsDetail } from "./pages/goods-detail";

const { Title } = Typography;

export type PageView =
  | { type: "list" }
  | { type: "create" }
  | { type: "edit"; id: string }
  | { type: "detail"; id: string };

export const App: React.FC = () => {
  const [view, setView] = useState<PageView>({ type: "list" });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Title level={4} className="!mb-0 !text-gray-800">
            商品管理平台
          </Title>
          {view.type !== "list" && (
            <a className="text-blue-500 cursor-pointer hover:text-blue-600" onClick={() => setView({ type: "list" })}>
              ← 返回列表
            </a>
          )}
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-6">
        {view.type === "list" && <GoodsList onNavigate={setView} />}
        {view.type === "create" && <GoodsForm mode="create" onBack={() => setView({ type: "list" })} />}
        {view.type === "edit" && <GoodsForm mode="edit" id={view.id} onBack={() => setView({ type: "list" })} />}
        {view.type === "detail" && <GoodsDetail id={view.id} onBack={() => setView({ type: "list" })} />}
      </main>
    </div>
  );
};
