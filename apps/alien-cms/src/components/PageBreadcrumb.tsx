import type { ReactNode } from "react";
import { Breadcrumb } from "antd";
import { Link } from "react-router-dom";
import { HomeOutlined } from "@ant-design/icons";

export interface PageBreadcrumbItem {
  title: ReactNode;
  to?: string;
}

interface PageBreadcrumbProps {
  items?: PageBreadcrumbItem[];
}

/** 非首页页面统一使用的路由面包屑。 */
export function PageBreadcrumb({ items = [] }: PageBreadcrumbProps) {
  return (
    <Breadcrumb
      items={[
        {
          title: (
            <Link to="/">
              <HomeOutlined /> 首页
            </Link>
          ),
        },
        ...items.map((item) => ({
          title: item.to ? <Link to={item.to}>{item.title}</Link> : item.title,
        })),
      ]}
    />
  );
}
