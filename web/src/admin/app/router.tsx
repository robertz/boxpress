import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./rootRoute";
import { authorEditRoute, authorNewRoute, authorsRoute } from "../modules/authors/routes";
import { homeRoute } from "../modules/home/routes";
import { insightsRoute } from "../modules/insights/routes";
import { accountRoute } from "../modules/account/routes";
import { mediaRoute } from "../modules/media/routes";
import { postCalendarRoute, postEditRoute, postNewRoute, postsRoute } from "../modules/posts/routes";
import { settingsRoute } from "../modules/settings/routes";
import { logsRoute, serverRoute } from "../modules/system/routes";

const routeTree = rootRoute.addChildren([
	homeRoute,
	postsRoute,
	postNewRoute,
	postCalendarRoute,
	postEditRoute,
	mediaRoute,
	insightsRoute,
	authorsRoute,
	authorNewRoute,
	authorEditRoute,
	settingsRoute,
	serverRoute,
	logsRoute,
	accountRoute,
]);

export const router = createRouter({
	routeTree,
	basepath: "/admin",
	defaultPreload: "intent",
	scrollRestoration: true,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
