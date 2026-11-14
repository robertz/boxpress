import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/jetbrains-mono";
import "./site.css";

// Code blocks are highlighted only on pages that have them, so highlight.js
// (and its theme) loads nowhere else.
const blocks = document.querySelectorAll<HTMLElement>(".prose pre > code");
if (blocks.length) {
	void import("./code").then(({ enhanceCode }) => enhanceCode(blocks));
}

// Below 640px the section links don't fit in the header: the menu button shows them in a panel.
const menuButton = document.querySelector<HTMLButtonElement>(".site-header__menu");
const menu = document.getElementById("bp-menu");
if (menuButton && menu) {
	const setOpen = (open: boolean) => {
		menu.hidden = !open;
		menuButton.setAttribute("aria-expanded", String(open));
		menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
	};
	menuButton.addEventListener("click", () => setOpen(Boolean(menu.hidden)));
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && !menu.hidden) {
			setOpen(false);
			menuButton.focus();
		}
	});
	window.matchMedia("(min-width: 641px)").addEventListener("change", (query) => {
		if (query.matches) setOpen(false);
	});
}
