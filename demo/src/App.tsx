import React, { useState } from "react";
import { Typography } from "antd";
import { GoodsList } from "./pages/goods-list";
import { GoodsForm } from "./pages/goods-form";
import { GoodsDetail } from "./pages/goods-detail";
import { ReactionTest } from "./pages/reaction-test";

const { Title } = Typography;

export type PageView =
  | { type: "list" }
  | { type: "create" }
  | { type: "edit"; id: string }
  | { type: "detail"; id: string }
  | { type: "reaction-test" };

export const App: React.FC = () => {
  const [view, setView] = useState<PageView>({ type: "reaction-test" });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Title level={4} className="!mb-0 !text-gray-800">
            商品管理平台
          </Title>
          <nav className="flex gap-4">
            <a
              className={`cursor-pointer ${view.type === "list" ? "text-blue-600 font-medium" : "text-gray-500 hover:text-blue-500"}`}
              onClick={() => setView({ type: "list" })}
            >
              商品列表
            </a>
            <a
              className={`cursor-pointer ${view.type === "reaction-test" ? "text-blue-600 font-medium" : "text-gray-500 hover:text-blue-500"}`}
              onClick={() => setView({ type: "reaction-test" })}
            >
              Reaction 测试
            </a>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-6">
        {view.type === "list" && <GoodsList onNavigate={setView} />}
        {view.type === "create" && <GoodsForm mode="create" onBack={() => setView({ type: "list" })} />}
        {view.type === "edit" && <GoodsForm mode="edit" id={view.id} onBack={() => setView({ type: "list" })} />}
        {view.type === "detail" && <GoodsDetail id={view.id} onBack={() => setView({ type: "list" })} />}
        {view.type === "reaction-test" && <ReactionTest />}
      </main>
    </div>
  );
};
