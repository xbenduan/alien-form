export { getSchema } from "./schema";
export { schemaRendererHandlers } from "./schema-renderer";

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const key = "ALIEN_FORM_DATA";

export const createData = async (data: any) => {
  await sleep(200);
  window.localStorage.setItem(key, JSON.stringify(data));
  return { status: "ok", message: "success" };
};

export const getDetail = async () => {
  await sleep(500);
  const data = window.localStorage.getItem(key);
  return JSON.parse(data || "{}");
};
