import type { FieldComponentProps } from "../../../types/shared";
import { renderGridChildren } from "../../../components/grid";

/** 唯一的分组布局容器：栅格卡片。 */
export default function GridLayout(props: FieldComponentProps) {
  return (
    <fieldset className="af-grid-layout af-layout-card">
      {props.title ? <legend className="af-card-title">{props.title}</legend> : null}
      {props.description ? <div className="af-card-desc">{props.description}</div> : null}
      {renderGridChildren(props.children, {
        gridSpan: props.gridSpan,
        columns: props.columns,
        gutter: props.gutter,
      })}
    </fieldset>
  );
}
