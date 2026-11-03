document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const source = document.getElementById(button.dataset.copy);
    const status = document.getElementById("copy-status");
    if (!source || !status) return;
    try {
      await navigator.clipboard.writeText(source.textContent);
      status.textContent = "已复制完整模型 JSON。";
    } catch {
      const range = document.createRange();
      range.selectNodeContents(source);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = "请使用系统复制快捷键复制已选中的 JSON。";
    }
  });
});
