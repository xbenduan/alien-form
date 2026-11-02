import { isObject } from "formwork/model";

/** 将历史全局记录 View 明确展开到 list 和 tree-list，保留已有本地覆盖。 */
export function migratePageLocalViews(input: unknown): unknown {
  if (!isObject(input) || !isObject(input.views)) return input;
  const views = { ...input.views };
  for (const name of ["add", "edit", "detail"]) {
    if (!Object.hasOwn(views, name)) continue;
    for (const router of ["list", "tree-list"]) {
      const target = `${router}/${name}`;
      if (!Object.hasOwn(views, target)) views[target] = views[name];
    }
    delete views[name];
  }
  return { ...input, views };
}
