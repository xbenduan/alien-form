/**
 * Mock data store — all interfaces are async (simulating real API calls).
 */
import type { IFormSchema } from "@alien-form/react";
import { goodsFormSchema } from "@/schema";

export type GoodsStatus = "active" | "reviewing" | "draft" | "offline";

export interface GoodsSpec {
  name: string;
  values: string[];
}

export interface GoodsSku {
  specAttrs: Record<string, string>;
  price: number;
  stock: number;
  status: 0 | 1;
}

export interface GoodsItem {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: GoodsStatus;
  cover: string;
  description: string;
  specs: GoodsSpec[];
  skus: GoodsSku[];
  createdAt: string;
  updatedAt: string;
}

// ─── Async delay ──────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Data store ───────────────────────────────────────────────────────────────

let nextId = 4;

let goods: GoodsItem[] = [
  {
    id: "1",
    name: "iPhone 15 Pro Max",
    category: "electronics",
    price: 9999,
    stock: 120,
    status: "active",
    cover: "https://picsum.photos/seed/iphone/200/200",
    description: "Apple iPhone 15 Pro Max，A17 Pro 芯片，钛金属设计，超视网膜 XDR 显示屏",
    specs: [
      { name: "颜色", values: ["原色钛金属", "蓝色钛金属", "黑色钛金属"] },
      { name: "存储", values: ["256GB", "512GB", "1TB"] },
    ],
    skus: [
      { specAttrs: { "颜色": "原色钛金属", "存储": "256GB" }, price: 9999, stock: 20, status: 1 },
      { specAttrs: { "颜色": "原色钛金属", "存储": "512GB" }, price: 11999, stock: 15, status: 1 },
      { specAttrs: { "颜色": "原色钛金属", "存储": "1TB" }, price: 13999, stock: 10, status: 1 },
      { specAttrs: { "颜色": "蓝色钛金属", "存储": "256GB" }, price: 9999, stock: 18, status: 1 },
      { specAttrs: { "颜色": "蓝色钛金属", "存储": "512GB" }, price: 11999, stock: 12, status: 1 },
      { specAttrs: { "颜色": "蓝色钛金属", "存储": "1TB" }, price: 13999, stock: 8, status: 0 },
      { specAttrs: { "颜色": "黑色钛金属", "存储": "256GB" }, price: 9999, stock: 22, status: 1 },
      { specAttrs: { "颜色": "黑色钛金属", "存储": "512GB" }, price: 11999, stock: 10, status: 1 },
      { specAttrs: { "颜色": "黑色钛金属", "存储": "1TB" }, price: 13999, stock: 5, status: 0 },
    ],
    createdAt: "2024-09-15T10:00:00Z",
    updatedAt: "2024-12-01T08:30:00Z",
  },
  {
    id: "2",
    name: "Nike Air Max 270",
    category: "clothing",
    price: 1099,
    stock: 350,
    status: "reviewing",
    cover: "https://picsum.photos/seed/nike/200/200",
    description: "Nike Air Max 270 运动休闲跑鞋，大气垫缓震，轻盈透气",
    specs: [
      { name: "颜色", values: ["黑白", "纯白", "灰蓝"] },
      { name: "尺码", values: ["40", "41", "42", "43", "44"] },
    ],
    skus: [
      { specAttrs: { "颜色": "黑白", "尺码": "40" }, price: 1099, stock: 30, status: 1 },
      { specAttrs: { "颜色": "黑白", "尺码": "41" }, price: 1099, stock: 25, status: 1 },
      { specAttrs: { "颜色": "黑白", "尺码": "42" }, price: 1099, stock: 40, status: 1 },
      { specAttrs: { "颜色": "黑白", "尺码": "43" }, price: 1099, stock: 35, status: 1 },
      { specAttrs: { "颜色": "黑白", "尺码": "44" }, price: 1099, stock: 20, status: 1 },
      { specAttrs: { "颜色": "纯白", "尺码": "40" }, price: 1099, stock: 15, status: 1 },
      { specAttrs: { "颜色": "纯白", "尺码": "42" }, price: 1099, stock: 30, status: 1 },
      { specAttrs: { "颜色": "灰蓝", "尺码": "41" }, price: 1199, stock: 20, status: 1 },
      { specAttrs: { "颜色": "灰蓝", "尺码": "43" }, price: 1199, stock: 18, status: 0 },
    ],
    createdAt: "2025-01-10T14:20:00Z",
    updatedAt: "2025-03-05T09:15:00Z",
  },
  {
    id: "3",
    name: "小米智能台灯 Pro",
    category: "home",
    price: 249,
    stock: 800,
    status: "draft",
    cover: "https://picsum.photos/seed/lamp/200/200",
    description: "米家智能台灯 Pro，支持 HomeKit，色温亮度无极调节，读写双模式",
    specs: [
      { name: "颜色", values: ["白色", "黑色"] },
    ],
    skus: [
      { specAttrs: { "颜色": "白色" }, price: 249, stock: 500, status: 1 },
      { specAttrs: { "颜色": "黑色" }, price: 249, stock: 300, status: 1 },
    ],
    createdAt: "2025-04-20T16:00:00Z",
    updatedAt: "2025-04-20T16:00:00Z",
  },
];

// ─── Async CRUD APIs ──────────────────────────────────────────────────────────

export async function fetchGoods(): Promise<GoodsItem[]> {
  await sleep(500);
  return [...goods];
}

export async function fetchGoodsByStatus(status: GoodsStatus | "all"): Promise<GoodsItem[]> {
  await sleep(500);
  if (status === "all") return [...goods];
  return goods.filter((g) => g.status === status);
}

export async function fetchGoodsById(id: string): Promise<GoodsItem | null> {
  await sleep(500);
  return goods.find((g) => g.id === id) ?? null;
}

export async function fetchGoodsSchema(): Promise<IFormSchema> {
  await sleep(500);
  return goodsFormSchema;
}

export async function createGoods(data: Omit<GoodsItem, "id" | "createdAt" | "updatedAt">): Promise<GoodsItem> {
  await sleep(500);
  const now = new Date().toISOString();
  const item: GoodsItem = {
    ...data,
    id: String(nextId++),
    createdAt: now,
    updatedAt: now,
  };
  goods = [item, ...goods];
  return item;
}

export async function updateGoods(id: string, data: Partial<Omit<GoodsItem, "id" | "createdAt">>): Promise<GoodsItem | null> {
  await sleep(500);
  const index = goods.findIndex((g) => g.id === id);
  if (index === -1) return null;
  goods[index] = { ...goods[index], ...data, updatedAt: new Date().toISOString() };
  goods = [...goods];
  return goods[index];
}

export async function deleteGoods(id: string): Promise<boolean> {
  await sleep(500);
  const len = goods.length;
  goods = goods.filter((g) => g.id !== id);
  return goods.length < len;
}
