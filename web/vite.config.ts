import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// The BoxLang server; `npm run dev` proxies the API and everything the
// server renders to it, so http://localhost:5173 is the whole site with
// hot reload for the admin.
const server = process.env.BOXPRESS_SERVER ?? "http://localhost:8080";

// In development every /admin address is the admin app, as the server
// answers in production (server/routes/Api.bx serveAdmin).
function adminFallback(): Plugin {
	return {
		name: "boxpress-admin-fallback",
		configureServer(dev) {
			dev.middlewares.use((req, _res, next) => {
				if (req.url && /^\/admin(\/|$|\?)/.test(req.url)) req.url = "/admin.html";
				next();
			});
		},
	};
}

// One build for both halves: the admin app (admin.html) and the public
// site's stylesheet and script (src/site/main.ts), which the server's
// templates find through dist/.vite/manifest.json.
export default defineConfig({
	plugins: [react(), adminFallback()],
	publicDir: false,
	build: {
		outDir: "dist",
		emptyOutDir: true,
		manifest: true,
		// fonts stay files: the site's CSP allows fonts from 'self', not data: URLs
		assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
		rolldownOptions: {
			input: {
				admin: "admin.html",
				site: "src/site/main.ts",
			},
		},
	},
	server: {
		port: 5173,
		strictPort: true,
		proxy: {
			"^/(?!admin|src/|@|node_modules/|assets/).*": { target: server, changeOrigin: false },
		},
	},
});
