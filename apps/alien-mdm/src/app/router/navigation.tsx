import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { matchPath, useLocation } from "react-router-dom";
import { publicRoutes, staticRoutes } from "./static-routes";

export interface NavigationItem {
  key: string;
  path: string;
  title: string;
}

interface PublishedTitle {
  path: string;
  title?: string;
}

interface NavigationValue {
  items: NavigationItem[];
  publishTitle: (path: string, title?: string) => void;
}

/** 系统首页始终是导航根节点。 */
const HOME_ITEM: NavigationItem = { key: "home", path: "/", title: "首页" };

/** 浏览器标签页统一使用的产品名。 */
const PRODUCT_TITLE = "ALIEN MDM";

const NavigationContext = createContext<NavigationValue | null>(null);

function resolveStaticItem(pathname: string): NavigationItem | undefined {
  for (const route of [...publicRoutes, ...staticRoutes]) {
    const match = matchPath({ path: route.path, end: true }, pathname);
    if (!match) continue;
    return {
      key:
        route.navigationKey ??
        `static:${route.path}:${Object.values(match.params).filter(Boolean).join(":")}`,
      path: pathname,
      title: route.title,
    };
  }
  return undefined;
}

function resolveDynamicItem(pathname: string, title?: string): NavigationItem | undefined {
  if (!title) return undefined;
  const match = matchPath("/records/:modelCode/*", pathname);
  const modelCode = match?.params.modelCode;
  if (!modelCode) return undefined;
  const segment = match.params["*"]?.split("/").filter(Boolean)[0] ?? "list";
  return {
    key: `record:${modelCode}:${segment}`,
    path: pathname,
    title,
  };
}

/** 已存在的路由会被更新并截断其后历史，从而保证路径栈不成环。 */
export function updateNavigationItems(
  items: NavigationItem[],
  current: NavigationItem,
): NavigationItem[] {
  if (current.key === HOME_ITEM.key) return [HOME_ITEM];
  const index = items.findIndex((item) => item.key === current.key);
  if (index < 0) return [...items, current];
  const previous = items[index];
  if (
    index === items.length - 1 &&
    previous?.path === current.path &&
    previous.title === current.title
  ) {
    return items;
  }
  return [...items.slice(0, index), current];
}

export function NavigationProvider({ children }: PropsWithChildren) {
  const location = useLocation();
  const [items, setItems] = useState<NavigationItem[]>([HOME_ITEM]);
  const [publishedTitle, setPublishedTitle] = useState<PublishedTitle>();
  const dynamicTitle =
    publishedTitle?.path === location.pathname ? publishedTitle.title : undefined;
  const current = useMemo(
    () =>
      resolveStaticItem(location.pathname) ?? resolveDynamicItem(location.pathname, dynamicTitle),
    [dynamicTitle, location.pathname],
  );
  const publishTitle = useCallback((path: string, title?: string) => {
    setPublishedTitle((previous) =>
      previous?.path === path && previous.title === title ? previous : { path, title },
    );
  }, []);

  useEffect(() => {
    if (current) setItems((previous) => updateNavigationItems(previous, current));
  }, [current]);

  useEffect(() => {
    if (current) document.title = `${current.title} | ${PRODUCT_TITLE}`;
  }, [current]);

  const value = useMemo(() => ({ items, publishTitle }), [items, publishTitle]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigationItems(): NavigationItem[] {
  const navigation = useContext(NavigationContext);
  if (!navigation) throw new Error("NavigationProvider is missing");
  return navigation.items;
}

/** 动态页将 Schema 中当前页面的标题发布给全局导航。 */
export function usePageTitle(title?: string): void {
  const navigation = useContext(NavigationContext);
  const location = useLocation();
  if (!navigation) throw new Error("NavigationProvider is missing");
  const { publishTitle } = navigation;

  useEffect(() => {
    publishTitle(location.pathname, title);
    return () => publishTitle(location.pathname);
  }, [location.pathname, publishTitle, title]);
}
