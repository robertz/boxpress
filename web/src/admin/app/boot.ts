/**
 * Who is signed in, from GET /api/auth/session, which the app asks before it
 * renders anything (main.tsx). setBoot() replaces it after signing in, or
 * after a passkey confirms the session; `boot` and `isAdmin` are live
 * bindings, so every reader sees the current values.
 */
export interface Me {
	id: number;
	username: string;
	displayName: string;
	email: string;
	bio: string;
	avatarUrl: string;
	website: string;
	initials: string;
	role: "admin" | "author";
	// the admin role's powers in this session: an admin who hasn't confirmed with a passkey (where that's required) has none yet
	isAdmin: boolean;
	adminNeedsPasskey: boolean;
	passkeys: number;
}

export interface Boot {
	user: Me;
	csrfToken: string;
	siteName: string;
	passkeysForAdmins: boolean;
}

export let boot: Boot = {
	user: {
		id: 0,
		username: "",
		displayName: "",
		email: "",
		bio: "",
		avatarUrl: "",
		website: "",
		initials: "",
		role: "author",
		isAdmin: false,
		adminNeedsPasskey: false,
		passkeys: 0,
	},
	csrfToken: "",
	siteName: "BoxPress",
	passkeysForAdmins: false,
};

export let isAdmin = false;

export function setBoot(next: Boot) {
	boot = next;
	isAdmin = next.user.isAdmin;
}

export function setCsrfToken(token: string) {
	boot = { ...boot, csrfToken: token };
}

export function setMe(user: Me) {
	boot = { ...boot, user };
	isAdmin = user.isAdmin;
}
