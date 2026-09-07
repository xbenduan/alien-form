import { fieldGridStyle } from "@utils/field-grid";
import { ComplexFieldFrame, TableComplexCell } from "./complex-field";
import { buildProps, type ComplexFieldProps } from "./shared";
import styles from "./index.module.css";

export function ObjectField(props: ComplexFieldProps) {
  const { children } = props;
  const { controlProps, value } = buildProps(props);
  if (controlProps.isTable) {
    return (
      <TableComplexCell
        value={value}
        schema={controlProps.schema as ComplexFieldProps["schema"]}
        title={controlProps.title as string | undefined}
        domain={controlProps.domain as string | undefined}
      />
    );
  }

  return (
    <ComplexFieldFrame
      title={controlProps.title as string | undefined}
      description={controlProps.description as string | undefined}
    >
      <div
        className={styles.objectField}
        style={fieldGridStyle({
          gridSpan: controlProps.gridSpan as number | undefined,
          columns: controlProps.columns as number | undefined,
          gutter: controlProps.gutter as number | undefined,
        })}
      >
        {children}
      </div>
    </ComplexFieldFrame>
  );
}
