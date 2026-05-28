/**
 * 大多数情况下详情的展示用 text 就够了，如果要对特殊的详情做处理那么直接新建一个组件即可
 */

import { getDetail, getSchema } from "@/mock";
import { IFormSchema } from "@alien-form/react";
import { useEffect, useState } from "react";
import { AlienForm } from "./alien-form";
import { FormItem } from "@alien-form/ui";

const Text = ({ value }: any) => <div className="text-gray-400">{value}</div>;

const components = { Input: Text, Select: Text, Textarea: Text, Switch: Text };
const decorators = { FormItem };

export const ViewAlienForm = () => {
  const [schema, setSchema] = useState<IFormSchema | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    getSchema().then((schema) => {
      setSchema(schema);
      // 模拟先请求 schema 在获取数据
      getDetail().then((res) => {
        setData(res);
      });
    });
  }, []);

  if (!schema || !data) {
    return <>加载中……</>;
  }

  return <AlienForm data={data} schema={schema} components={components} decorators={decorators} />;
};
