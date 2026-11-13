import hljs from "highlight.js/lib/common";
import "highlight.js/styles/github-dark.css";

/** Highlights each block, and gives it a header with its language and a Copy button. */
export function enhanceCode(blocks: NodeListOf<HTMLElement>) {
	for (const code of blocks) {
		const pre = code.parentElement!;
		const language = /language-([\w+#-]+)/.exec(code.className)?.[1] ?? "";
		if (language && hljs.getLanguage(language)) {
			hljs.highlightElement(code);
		} else if (!language) {
			code.classList.add("hljs");
		} else {
			hljs.highlightElement(code);
		}

		const header = document.createElement("div");
		header.className = "code-header";
		const label = document.createElement("span");
		label.textContent = language || "code";
		const copy = document.createElement("button");
		copy.type = "button";
		copy.textContent = "Copy";
		copy.addEventListener("click", async () => {
			try {
				await navigator.clipboard.writeText(code.innerText);
				copy.textContent = "Copied";
			} catch {
				copy.textContent = "Couldn't copy";
			}
			window.setTimeout(() => (copy.textContent = "Copy"), 1500);
		});
		header.append(label, copy);
		pre.before(header);
		pre.classList.add("has-header");
	}
}
