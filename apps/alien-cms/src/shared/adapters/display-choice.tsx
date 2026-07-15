import DisplayText from "./display-text";
import type { DisplayValueProps } from "./types";

export function DisplayChoice(props: DisplayValueProps) {
  return <DisplayText {...props} />;
}

export default DisplayChoice;
