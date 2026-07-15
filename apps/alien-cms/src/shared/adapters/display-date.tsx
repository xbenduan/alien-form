import DisplayText from "./display-text";
import type { DisplayValueProps } from "./types";

export function DisplayDate(props: DisplayValueProps) {
  return <DisplayText {...props} format={props.format ?? "date"} />;
}

export default DisplayDate;
