import add from "./add";
import edit from "./edit";
import detail from "./detail";

/** 显式注册列表所属的记录窗口，可被其他 Page 复用。 */
export const windows = { add, edit, detail };
