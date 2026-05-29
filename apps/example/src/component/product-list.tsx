import React, { useEffect, useState } from "react";
import { getProductList, deleteProduct, type Product } from "@/mock";

const PAGE_SIZE = 3;

export const ProductList: React.FC<{
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDetail: (id: string) => void;
}> = ({ onAdd, onEdit, onDetail }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true);
    getProductList().then((list) => {
      setProducts(list);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const pagedProducts = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定要删除该商品吗？")) return;
    await deleteProduct(id);
    load();
    if (pagedProducts.length === 1 && page > 1) {
      setPage(page - 1);
    }
  };

  return (
    <div>
      {/* 头部 */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">商品管理</h1>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          + 新增
        </button>
      </div>

      {/* 表格 */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">商品名称</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">售价</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">原价</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">库存</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">状态</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  加载中…
                </td>
              </tr>
            ) : pagedProducts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  暂无商品，点击右上角「+ 新增」添加
                </td>
              </tr>
            ) : (
              pagedProducts.map((product) => (
                <tr key={product.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{product.name || "未命名商品"}</td>
                  <td className="px-4 py-3 text-foreground">
                    {product.price ? `¥${product.price.toFixed(2)}` : "-"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground line-through">
                    {product.originalPrice ? `¥${product.originalPrice.toFixed(2)}` : "-"}
                  </td>
                  <td className="px-4 py-3 text-foreground">{product.stock ?? 0}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        product.status === "on"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {product.status === "on" ? "在售" : "下架"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onDetail(product.id)}
                        className="text-xs text-primary hover:text-primary/80 transition-colors"
                      >
                        详情
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(product.id)}
                        className="text-xs text-primary hover:text-primary/80 transition-colors"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id)}
                        className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {products.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>共 {products.length} 条</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded border px-3 py-1 transition-colors hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
            >
              上一页
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                type="button"
                onClick={() => setPage(i + 1)}
                className={`rounded border px-3 py-1 transition-colors ${
                  page === i + 1
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded border px-3 py-1 transition-colors hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
