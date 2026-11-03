import { render } from "solid-js/web";
import { Formwork } from "formwork";
import app from "./formwork/index";
import { MessageHost } from "./components/ui/message";
import "./formwork/shell/styles.css";

render(
  () => (
    <>
      <Formwork app={app} class="root-formwork" />
      <div class="root-formwork">
        <MessageHost />
      </div>
    </>
  ),
  document.getElementById("root")!,
);
