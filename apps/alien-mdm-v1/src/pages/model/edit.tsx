import { Navigate, useParams } from "react-router-dom";
import { ModelEditor } from "./editor";

export default function ModelEditPage() {
  const { modelCode } = useParams();
  return modelCode ? <ModelEditor modelCode={modelCode} /> : <Navigate to="/models" replace />;
}
