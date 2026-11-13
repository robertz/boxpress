import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { ApiError, whenSignedOut } from "./app/api";
import { LoginPage } from "./app/LoginPage";
import { router } from "./app/router";
import { loadSession } from "./app/session";
import { ManageTheme } from "./app/theme";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			refetchOnWindowFocus: false,
			// An answer from the server is final; only a request that never
			// got one (a dropped connection) is worth a second try.
			retry: (failureCount, error) => !(error instanceof ApiError) && failureCount < 1,
		},
	},
});

function App({ signedIn: initiallySignedIn }: { signedIn: boolean }) {
	const [signedIn, setSignedIn] = useState(initiallySignedIn);
	whenSignedOut(() => {
		queryClient.clear();
		setSignedIn(false);
	});
	if (!signedIn) return <LoginPage onSignedIn={() => setSignedIn(true)} />;
	return (
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	);
}

const root = createRoot(document.getElementById("admin-root")!);

loadSession()
	.then((signedIn) => {
		root.render(
			<StrictMode>
				<ManageTheme>
					<App signedIn={signedIn} />
				</ManageTheme>
			</StrictMode>,
		);
	})
	.catch(() => {
		document.getElementById("admin-root")!.textContent = "The server didn't answer. Reload to try again.";
	});
