export { getSchema } from "./schema";
export { schemaRendererHandlers } from "./schema-renderer";

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const STORAGE_KEY = "ALIEN_FORM_PRODUCTS";
const MAX_ITEMS = 5;

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  stock: number;
  status: "on" | "off";
  specs?: any[];
  skus?: any[];
  createdAt: number;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getAll(): Product[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(products: Product[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

/** 获取商品列表 */
export const getProductList = async (): Promise<Product[]> => {
  await sleep(200);
  return getAll();
};

/** 获取单个商品详情 */
export const getProduct = async (id: string): Promise<Product | null> => {
  await sleep(200);
  const products = getAll();
  return products.find((p) => p.id === id) ?? null;
};

/** 创建商品 */
export const createProduct = async (data: Omit<Product, "id" | "createdAt">): Promise<{ success: boolean; message: string }> => {
  await sleep(200);
  const products = getAll();
  if (products.length >= MAX_ITEMS) {
    return { success: false, message: `最多只能添加 ${MAX_ITEMS} 条商品` };
  }
  const product: Product = {
    ...data,
    id: generateId(),
    createdAt: Date.now(),
  };
  products.unshift(product);
  saveAll(products);
  return { success: true, message: "创建成功" };
};

/** 更新商品 */
export const updateProduct = async (id: string, data: Partial<Product>): Promise<{ success: boolean; message: string }> => {
  await sleep(200);
  const products = getAll();
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) {
    return { success: false, message: "商品不存在" };
  }
  products[index] = { ...products[index], ...data };
  saveAll(products);
  return { success: true, message: "保存成功" };
};

/** 删除商品 */
export const deleteProduct = async (id: string): Promise<{ success: boolean; message: string }> => {
  await sleep(200);
  const products = getAll();
  const filtered = products.filter((p) => p.id !== id);
  saveAll(filtered);
  return { success: true, message: "删除成功" };
};

/** 计算总库存（从 skus 汇总） */
export function calcTotalStock(skus?: any[]): number {
  if (!skus || !Array.isArray(skus)) return 0;
  return skus.reduce((sum, sku) => sum + (Number(sku.stock) || 0), 0);
}

/** 计算最低售价 */
export function calcMinPrice(skus?: any[]): number {
  if (!skus || !Array.isArray(skus) || skus.length === 0) return 0;
  const prices = skus.map((s) => Number(s.price) || 0).filter((p) => p > 0);
  return prices.length > 0 ? Math.min(...prices) : 0;
}
