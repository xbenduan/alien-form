import { useParams } from "react-router-dom";
import {
  ModelRuntimePage,
  type ModelPageScene,
} from "../../runtime/react";

export interface RecordRouteProps {
  scene: ModelPageScene;
}

/** URL 参数到通用 runtime 页面的薄适配器。 */
export default function RecordRoute({ scene }: RecordRouteProps) {
  const { modelName = "", recordId } = useParams();
  return (
    <ModelRuntimePage
      model={modelName}
      scene={scene}
      recordId={recordId}
    />
  );
}
