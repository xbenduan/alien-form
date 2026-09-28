import { useMatch, useParams } from "react-router-dom";
import { ModelEditor } from "./components/model-editor";

export default function ModelEditorRoute() {
  const { modelCode } = useParams();
  const copy = Boolean(useMatch("/models/:modelCode/copy"));

  if (!modelCode) return <ModelEditor />;
  return copy ? <ModelEditor copyFrom={modelCode} /> : <ModelEditor modelCode={modelCode} />;
}
