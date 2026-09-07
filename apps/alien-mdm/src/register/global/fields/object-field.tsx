import { fieldGridStyle } from "@utils/field-grid";
import { ComplexFieldFrame, TableComplexCell } from "./complex-field";
import { buildProps, type ComplexFieldProps } from "./shared";
import styles from "./index.module.css";

export function ObjectField(props: ComplexFieldProps) {
  const {
    children,
    value,
    isTable,
    schema,
    title,
    description,
    domain,
    gridSpan,
    columns,
    gutter,
  } = buildProps(props);
  if (isTable) {
    return <TableComplexCell value={value} schema={schema} title={title} domain={domain} />;
  }

  return (
    <ComplexFieldFrame title={title} description={description} gridSpan={gridSpan}>
      <div
        className={styles.objectField}
        style={fieldGridStyle({
          columns,
          gutter,
        })}
      >
        {children}
      </div>
    </ComplexFieldFrame>
  );
}
