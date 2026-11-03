import type { Component } from "solid-js";
import type { PageContext } from "formwork";
import { RecordList } from "../../formwork/data/record-list";

/** 由列表页面代码承载记录区布局。 */
export const List: Component<PageContext> = (ctx) => <RecordList ctx={ctx} />;
