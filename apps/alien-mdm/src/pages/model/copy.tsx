import { Navigate, useParams } from "react-router-dom";
import { ModelEditor } from "./components/model-editor";

export default function ModelCopyPage() {
  const { modelCode } = useParams();
  return modelCode ? <ModelEditor copyFrom={modelCode} /> : <Navigate to="/models" replace />;
}
