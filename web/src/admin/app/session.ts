import { api } from "./api";
import { setBoot, setCsrfToken, setMe, boot, type Boot, type Me } from "./boot";
import { signWithPasskey, type RequestOptions } from "./passkeys";

interface SessionAnswer {
	authenticated: boolean;
	user: Me | null;
	siteName: string;
	passkeysForAdmins: boolean;
	csrfToken: string;
}

/** Asks who is signed in; true when someone is (and boot then holds them). */
export async function loadSession(): Promise<boolean> {
	const answer = await api.get<SessionAnswer>("/auth/session");
	setBoot({
		user: answer.user ?? boot.user,
		csrfToken: answer.csrfToken,
		siteName: answer.siteName,
		passkeysForAdmins: answer.passkeysForAdmins,
	} satisfies Boot);
	return answer.authenticated;
}

export async function signIn(username: string, password: string) {
	const answer = await api.post<{ user: Me; csrfToken: string }>("/auth/login", { username, password });
	setCsrfToken(answer.csrfToken);
	setMe(answer.user);
}

/** Signs in with a passkey; false when the person closed the browser's sheet. */
export async function signInWithPasskey(): Promise<boolean> {
	const options = await api.post<RequestOptions>("/auth/passkey/options", {});
	const assertion = await signWithPasskey(options);
	if (!assertion) return false;
	const answer = await api.post<{ user: Me; csrfToken: string }>("/auth/passkey/login", assertion);
	setCsrfToken(answer.csrfToken);
	setMe(answer.user);
	return true;
}

/** Confirms the signed-in account with one of its passkeys (an admin's powers may need it); false when cancelled. */
export async function confirmWithPasskey(): Promise<boolean> {
	const options = await api.post<RequestOptions>("/auth/passkey/options", { confirm: true });
	const assertion = await signWithPasskey(options);
	if (!assertion) return false;
	setMe(await api.post<Me>("/account/passkeys/confirm", assertion));
	return true;
}

export async function signOut() {
	await api.post("/auth/logout").catch(() => undefined);
	window.location.assign("/admin");
}
