import { render } from "solid-js/web";
import app from "./formwork/index";
import "./formwork/shell/styles.css";

render(() => <app.render />, document.getElementById("root")!);
