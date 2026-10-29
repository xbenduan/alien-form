import localModels from "virtual:formwork/models";
import { createHttpModelSource } from "formwork/model";

/** 保留 Vite 的完整本地源，供显式上传读取。 */
export { localModels };
/** 提供独立开发服务的完整远端模型源。 */
export const remoteModels = createHttpModelSource({ url: "/api/models" });
/** 选择当前应用唯一模型源，上传操作不会修改此选择。 */
export const models = import.meta.env.VITE_MODEL_SOURCE === "remote" ? remoteModels : localModels;
/** 标记当前目录和编辑动作所使用的模型源。 */
export const modelSourceName = import.meta.env.VITE_MODEL_SOURCE === "remote" ? "remote" : "local";
