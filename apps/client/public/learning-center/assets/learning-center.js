// 保持正文与示例静态可读，脚本仅增强导航、复制与本页演示。
const chapters = [...document.querySelectorAll(".chapter")];
const links = [...document.querySelectorAll('nav[aria-label="章节目录"] a')];
const contents = document.querySelector(".contents");
const search = document.querySelector("#chapter-search");
const searchStatus = document.querySelector("#search-status");
const clearSearch = document.querySelector("#clear-search");
const actionStatus = document.querySelector("#action-status");
const emptyResults = document.querySelector("#empty-results");
const searchable = new Map(
  chapters.map((chapter) => [chapter, chapter.textContent.toLocaleLowerCase()]),
);
const mobile = window.matchMedia("(max-width: 760px)");
let noticeTimer;
let scrollFrame = 0;

function announce(message) {
  clearTimeout(noticeTimer);
  actionStatus.textContent = message;
  noticeTimer = setTimeout(() => {
    actionStatus.textContent = "";
  }, 5000);
}

function updateCurrentChapter() {
  scrollFrame = 0;
  const visible = chapters.filter((chapter) => !chapter.hidden);
  let current = visible[0];
  for (const chapter of visible) {
    if (chapter.getBoundingClientRect().top > 130) break;
    current = chapter;
  }
  for (const link of links) {
    if (link.hash === `#${current?.id}`) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}

function applySearch() {
  const terms = search.value.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  for (const chapter of chapters) {
    chapter.hidden = !terms.every((term) => searchable.get(chapter).includes(term));
  }
  for (const link of links) {
    link.parentElement.hidden = document.getElementById(link.hash.slice(1)).hidden;
  }
  for (const list of contents.querySelectorAll("ol")) {
    const hidden = [...list.children].every((item) => item.hidden);
    list.hidden = hidden;
    list.previousElementSibling.hidden = hidden;
  }
  const count = chapters.filter((chapter) => !chapter.hidden).length;
  searchStatus.textContent = terms.length
    ? `找到 ${count} / ${chapters.length} 个章节`
    : `${count} 个章节`;
  clearSearch.hidden = terms.length === 0;
  emptyResults.hidden = count !== 0;
  updateCurrentChapter();
}

function resetSearch() {
  search.value = "";
  applySearch();
}

function resizeContents() {
  contents.open = !mobile.matches;
}

// 用文本节点着色，复制和下载始终保留同一份原始代码。
function highlightJson(code, source) {
  const pattern =
    /"(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/gu;
  const fragment = document.createDocumentFragment();
  let offset = 0;
  for (const match of source.matchAll(pattern)) {
    fragment.append(document.createTextNode(source.slice(offset, match.index)));
    const token = document.createElement("span");
    token.className = match[0].endsWith(":")
      ? "json-key"
      : match[0].startsWith('"')
        ? "json-string"
        : "json-value";
    token.textContent = match[0];
    fragment.append(token);
    offset = match.index + match[0].length;
  }
  fragment.append(document.createTextNode(source.slice(offset)));
  code.replaceChildren(fragment);
}

for (const code of document.querySelectorAll(".codebox pre code")) {
  const source = code.textContent;
  if (code.classList.contains("language-json")) highlightJson(code, source);
  const actions = document.createElement("div");
  actions.className = "code-actions";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "复制";
  copy.setAttribute(
    "aria-label",
    `复制${code.closest(".codebox").querySelector(".codebar span").textContent}`,
  );
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(source);
      announce("已复制代码。按代码框标注的位置粘贴。");
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection.removeAllRanges();
      selection.addRange(range);
      code.parentElement.focus();
      announce("无法访问剪贴板，已选中代码，请按 ⌘C 或 Ctrl+C 复制。");
    }
  });
  actions.append(copy);
  if (code.dataset.download) {
    const download = document.createElement("button");
    download.type = "button";
    download.textContent = "下载 JSON";
    download.setAttribute("aria-label", `下载 ${code.dataset.download}`);
    download.addEventListener("click", () => {
      const url = URL.createObjectURL(new Blob([`${source}\n`], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = code.dataset.download;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      announce(`已准备下载 ${code.dataset.download}`);
    });
    actions.append(download);
  }
  code.closest(".codebox").querySelector(".codebar").append(actions);
}

const quantity = document.querySelector("#demo-quantity");
const price = document.querySelector("#demo-price");
const total = document.querySelector("#demo-total");
const mathStatus = document.querySelector("#demo-math-status");
const invoiceType = document.querySelector("#demo-invoice");
const company = document.querySelector("#demo-company");
const tax = document.querySelector("#demo-tax");
const invoiceStatus = document.querySelector("#demo-invoice-status");

function updateAmount() {
  const amount = quantity.valueAsNumber * price.valueAsNumber;
  const valid =
    quantity.value !== "" &&
    price.value !== "" &&
    quantity.validity.valid &&
    price.validity.valid &&
    Number.isFinite(amount);
  total.value = valid ? amount.toFixed(2) : "—";
  mathStatus.textContent = valid ? "" : "请输入大于等于 1 的整数数量和非负单价。";
  mathStatus.classList.toggle("sr-only", valid);
}

function updateInvoice() {
  const isCompany = invoiceType.value === "company";
  document.querySelector("[data-company]").hidden = !isCompany;
  tax.disabled = !company.value;
  tax.placeholder = company.value ? `请输入 ${company.value} 的税号` : "请先填写公司名称";
  invoiceStatus.textContent = !isCompany
    ? "选择“企业”后显示公司名称与税号；切回个人时保留已输入的值。"
    : company.value
      ? "税号已可编辑。切回个人会隐藏这两个字段，已有值仍然保留。"
      : "公司名称为空，税号暂时禁用。";
}

quantity.addEventListener("input", updateAmount);
price.addEventListener("input", updateAmount);
invoiceType.addEventListener("change", updateInvoice);
company.addEventListener("input", updateInvoice);
document.querySelector("#reset-demo").addEventListener("click", () => {
  quantity.value = "2";
  price.value = "18";
  invoiceType.value = "personal";
  company.value = "";
  tax.value = "";
  updateAmount();
  updateInvoice();
  announce("演示已重置。");
});

search.addEventListener("input", applySearch);
search.addEventListener("keydown", (event) => {
  if (event.key === "Escape") resetSearch();
});
clearSearch.addEventListener("click", () => {
  resetSearch();
  search.focus();
});
document.querySelector("#reset-search").addEventListener("click", () => {
  resetSearch();
  search.focus();
});

// 搜索后的跨章引用先恢复目标，原生锚点导航继续负责历史与键盘行为。
document.addEventListener("click", (event) => {
  const anchor = event.target.closest('a[href^="#"]');
  if (!anchor) return;
  const target = document.getElementById(anchor.hash.slice(1));
  if (!target) return;
  if (target.hidden || anchor.hash === "#start") resetSearch();
  if (mobile.matches && anchor.closest("nav")) contents.open = false;
});
window.addEventListener("hashchange", () => {
  const target = document.getElementById(location.hash.slice(1));
  if (target?.hidden) {
    resetSearch();
    target.scrollIntoView();
  }
  updateCurrentChapter();
});
window.addEventListener(
  "scroll",
  () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateCurrentChapter);
  },
  { passive: true },
);
mobile.addEventListener("change", resizeContents);

// 打印所有章节及练习答案，退出打印后恢复用户的展开状态。
let printDetails = [];
window.addEventListener("beforeprint", () => {
  printDetails = [...document.querySelectorAll(".exercise")].map((details) => [
    details,
    details.open,
  ]);
  for (const [details] of printDetails) details.open = true;
});
window.addEventListener("afterprint", () => {
  for (const [details, open] of printDetails) details.open = open;
  printDetails = [];
});

for (const element of document.querySelectorAll("[data-enhanced]")) element.hidden = false;
resizeContents();
updateAmount();
updateInvoice();
applySearch();
