import { HomeOutlined } from "@ant-design/icons";
import { Breadcrumb } from "antd";
import { Link } from "react-router-dom";

export interface PageBreadcrumbItem {
  key: string;
  path: string;
  title: string;
}

export function PageBreadcrumb({ items }: { items: PageBreadcrumbItem[] }) {
  return (
    <Breadcrumb
      items={items.map((item, index) => {
        const title = (
          <>
            {item.key === "home" ? <HomeOutlined /> : null}
            {item.key === "home" ? " " : null}
            {item.title}
          </>
        );
        return {
          key: item.key,
          title: index < items.length - 1 ? <Link to={item.path}>{title}</Link> : title,
        };
      })}
    />
  );
}
