import { getSchema } from "@/mock";
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

  return <AlienForm schema={schema} />;
};
