import type { ReactNode } from "react";
import { HomeOutlined } from "@ant-design/icons";
import { Breadcrumb } from "antd";
import { Link } from "react-router-dom";

export interface PageBreadcrumbItem {
  title: ReactNode;
  to?: string;
}

export function PageBreadcrumb({ items = [] }: { items?: PageBreadcrumbItem[] }) {
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
