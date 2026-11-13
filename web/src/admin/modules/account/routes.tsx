import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../../app/rootRoute";

export const accountRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/account",
	component: lazyRouteComponent(() => import("./AccountPage"), "AccountPage"),
});
