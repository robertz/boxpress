import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../../app/rootRoute";

export const mediaRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/media",
	component: lazyRouteComponent(() => import("./MediaPage"), "MediaPage"),
});
