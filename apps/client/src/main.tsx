import { render } from "solid-js/web";
import app from "./formwork";
import "./ui/styles.css";

render(() => <app.render />, document.getElementById("root")!);
