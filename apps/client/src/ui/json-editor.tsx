import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import {
  foldAll,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
  unfoldAll,
} from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { createEffect, onCleanup, onMount } from "solid-js";
import type { Component } from "solid-js";

const syntax = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--code-text)" },
  { tag: tags.string, color: "var(--cyan)" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--warning)" },
  { tag: tags.punctuation, color: "var(--muted)" },
]);

/** 编辑完整 JSON，支持语法着色、节点折叠与只读历史版本，外部值同步不触发 onChange。 */
export const JsonEditor: Component<{
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
}> = (props) => {
  let container!: HTMLDivElement;
  let view: EditorView | undefined;
  let syncing = false;
  const access = new Compartment();
  const accessMode = () => [
    EditorState.readOnly.of(!!props.readOnly || !!props.disabled),
    EditorView.editable.of(!props.readOnly && !props.disabled),
    EditorView.contentAttributes.of({
      "aria-label": "完整 definition JSON",
      "aria-readonly": String(!!props.readOnly),
      "aria-disabled": String(!!props.disabled),
      spellcheck: "false",
    }),
  ];
  onMount(() => {
    const state = (value: string) =>
      EditorState.create({
        doc: value,
        extensions: [
          json(),
          history(),
          lineNumbers(),
          foldGutter({
            markerDOM: (open) => {
              const marker = document.createElement("span");
              marker.className = "json-fold-toggle";
              marker.textContent = open ? "⌄" : "›";
              marker.title = open ? "折叠 JSON 节点" : "展开 JSON 节点";
              return marker;
            },
          }),
          indentOnInput(),
          highlightActiveLine(),
          syntaxHighlighting(syntax),
          keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]),
          access.of(accessMode()),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !syncing) props.onChange(update.state.doc.toString());
          }),
        ],
      });
    view = new EditorView({ parent: container, state: state(props.value) });
    createEffect(() => {
      const value = props.value;
      if (view && view.state.doc.toString() !== value) {
        syncing = true;
        try {
          view.setState(state(value));
        } finally {
          syncing = false;
        }
      }
    });
    createEffect(() => {
      view?.dispatch({ effects: access.reconfigure(accessMode()) });
    });
    onCleanup(() => view?.destroy());
  });
  return (
    <div class="json-editor">
      <div class="json-fold-actions" aria-label="JSON 折叠操作">
        <button class="text-button" type="button" onClick={() => view && foldAll(view)}>
          折叠全部
        </button>
        <button class="text-button" type="button" onClick={() => view && unfoldAll(view)}>
          展开全部
        </button>
      </div>
      <div
        ref={(element) => {
          container = element;
        }}
        class="code-editor"
      />
    </div>
  );
};
