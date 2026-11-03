import home from "./home";
import login from "./login";
import tokens from "./api-tokens";
import models from "./models";
import preview from "./model-preview";

/** 汇总普通页面，模型列表布局由 domains 独立注册。 */
export const pages = [home, login, tokens, models, preview];
