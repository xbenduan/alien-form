import { render } from "solid-js/web";
import { Formwork } from "formwork";
import app from "./formwork/index";
import "./formwork/shell/styles.css";

render(() => <Formwork app={app} class="root-formwork" />, document.getElementById("root")!);
