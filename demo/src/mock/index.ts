/**
 * Mock data store — all interfaces are async (simulating real API calls).
 */
import type { IFormSchema } from "@alien-form/react";
import { goodsFormSchema } from "@/schema";

export type GoodsStatus = "active" | "reviewing" | "draft" | "offline";

export interface GoodsSpec {
  name: string;
  value: string;
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
    description: "Apple iPhone 15 Pro Max 256GB 原色钛金属，A17 Pro 芯片，钛金属设计",
    specs: [
      { name: "颜色", value: "原色钛金属" },
      { name: "存储", value: "256GB" },
      { name: "屏幕", value: "6.7 英寸" },
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
      { name: "颜色", value: "黑白" },
      { name: "尺码", value: "40-45" },
      { name: "材质", value: "网面+合成革" },
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
      { name: "功率", value: "12W" },
      { name: "色温范围", value: "2700K-6500K" },
      { name: "连接方式", value: "Wi-Fi" },
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
