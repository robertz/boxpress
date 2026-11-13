import { boot } from "./boot";

export class ApiError extends Error {
	status: number;
	code: string;
	data: Record<string, unknown>;

	constructor(message: string, status: number, code = "", data: Record<string, unknown> = {}) {
		super(message);
		this.status = status;
		this.code = code;
		this.data = data;
	}
}

// Set by main.tsx: what to do when the session has ended (show the sign-in page).
let onSignedOut: () => void = () => window.location.reload();

export function whenSignedOut(handler: () => void) {
	onSignedOut = handler;
}

async function request<T>(method: string, path: string, payload?: unknown, raw?: Blob): Promise<T> {
	const headers: Record<string, string> = { Accept: "application/json" };
	if (method !== "GET") headers["X-CSRF-Token"] = boot.csrfToken;
	if (payload !== undefined) headers["Content-Type"] = "application/json";
	if (raw) headers["Content-Type"] = raw.type || "application/octet-stream";

	const res = await fetch(`/api${path}`, {
		method,
		headers,
		credentials: "same-origin",
		body: raw ?? (payload === undefined ? undefined : JSON.stringify(payload)),
	});

	if (res.status === 204) return undefined as T;
	const data = await res.json().catch(() => null);
	if (res.status === 401 && !path.startsWith("/auth/")) {
		onSignedOut();
		throw new ApiError("Your session has ended. Sign in again.", 401, "unauthorized");
	}
	if (!res.ok || data === null) {
		throw new ApiError(data?.message ?? "The request failed.", res.status, data?.code ?? "", data ?? {});
	}
	return data as T;
}

// Every path is under /api: api.get("/posts") is GET /api/posts.
export const api = {
	get: <T>(path: string) => request<T>("GET", path),
	post: <T>(path: string, payload?: unknown) => request<T>("POST", path, payload),
	put: <T>(path: string, payload?: unknown) => request<T>("PUT", path, payload),
	patch: <T>(path: string, payload?: unknown) => request<T>("PATCH", path, payload),
	delete: <T>(path: string) => request<T>("DELETE", path),
	upload: <T>(path: string, file: Blob) => request<T>("POST", path, undefined, file),
};

export function errorMessage(err: unknown, fallback: string): string {
	return err instanceof Error && err.message ? err.message : fallback;
}

export function isPasskeyRequired(err: unknown): boolean {
	return err instanceof ApiError && err.code === "passkey_required";
}
