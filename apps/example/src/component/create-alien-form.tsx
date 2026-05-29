import { createData, getSchema } from "@/mock";
import { useEffect, useState } from "react";
import { AlienForm } from "./alien-form";
import { IFormSchema } from "@alien-form/react";

export const CreateAlienForm = () => {
  const [schema, setSchema] = useState<IFormSchema | null>(null);

  useEffect(() => {
    getSchema().then((schema) => {
      setSchema(schema);
    });
  }, []);

  if (!schema) {
    return <>加载中……</>;
  }

  return (
    <AlienForm
      schema={schema}
      submitText="创建"
      onSubmit={async (values) => {
        await createData(values);
        alert("创建成功！");
      }}
    />
  );
};
