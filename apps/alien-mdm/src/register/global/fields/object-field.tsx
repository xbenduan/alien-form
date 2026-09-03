import { fieldGridStyle } from "@utils/field-grid";
import { ComplexFieldFrame, TableComplexCell } from "./complex-field";
import type { ComplexFieldProps } from "./shared";
import styles from "./index.module.css";

export function ObjectField({
  children,
  title,
  description,
  isTable,
  value,
  schema,
  domain,
  gridSpan,
  columns,
  gutter,
}: ComplexFieldProps) {
  if (isTable) {
    return <TableComplexCell value={value} schema={schema} title={title} domain={domain} />;
  }

  return (
    <ComplexFieldFrame title={title} description={description}>
      <div className={styles.objectField} style={fieldGridStyle({ gridSpan, columns, gutter })}>
        {children}
      </div>
    </ComplexFieldFrame>
  );
}
