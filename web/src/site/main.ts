import "./site.css";

// Code blocks are highlighted only on pages that have them, so highlight.js
// (and its theme) loads nowhere else.
const blocks = document.querySelectorAll<HTMLElement>(".prose pre > code");
if (blocks.length) {
	void import("./code").then(({ enhanceCode }) => enhanceCode(blocks));
}
