import { getDetail, getSchema } from "@/mock";
import { useEffect, useState } from "react";
import { AlienForm } from "./alien-form";
import { IFormSchema } from "@alien-form/react";

export const EditAlienForm = () => {
  const [schema, setSchema] = useState<IFormSchema | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    getSchema().then((schema) => {
      setSchema(schema);
    });
    getDetail().then((res) => {
      setData(res);
    });
  }, []);

  if (!schema || !data) {
    return <>加载中……</>;
  }

  return <AlienForm data={data} schema={schema} />;
};
