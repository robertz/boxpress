import { api } from "../../app/api";

/** An account as Admin > Authors sees it (server/services/Users.bx adminView()). */
export interface Author {
	id: string;
	username: string;
	displayName: string;
	email: string;
	role: "admin" | "author";
	about: string;
	avatarUrl: string;
	website: string;
	avatarLabel: string;
	disabled: boolean;
	postCount: number;
	passkeys: number;
	created: string;
	lastLoginAt: string | null;
}

export interface AuthorInput {
	username: string;
	displayName: string;
	email: string;
	role: string;
	about: string;
	avatarUrl: string;
	website: string;
	// Blank on an update keeps the current password.
	password: string;
}

interface ServerAccount {
	id: number;
	username: string;
	displayName: string;
	email: string;
	role: "admin" | "author";
	bio: string;
	avatarUrl: string;
	website: string;
	initials: string;
	disabled: boolean;
	postCount: number;
	passkeys: number;
	createdAt: string;
	lastLoginAt: string | null;
}

function authorOf(row: ServerAccount): Author {
	return {
		id: String(row.id),
		username: row.username,
		displayName: row.displayName,
		email: row.email,
		role: row.role,
		about: row.bio,
		avatarUrl: row.avatarUrl,
		website: row.website,
		avatarLabel: row.initials,
		disabled: row.disabled,
		postCount: row.postCount,
		passkeys: row.passkeys,
		created: row.createdAt,
		lastLoginAt: row.lastLoginAt,
	};
}

const userPath = (id: string) => `/admin/users/${encodeURIComponent(id)}`;

export const authorsApi = {
	list: () => api.get<ServerAccount[]>("/admin/users").then((rows) => rows.map(authorOf)),
	get: (id: string) =>
		api.get<ServerAccount[]>("/admin/users").then((rows) => {
			const found = rows.find((row) => String(row.id) === id);
			if (!found) throw new Error("No such author.");
			return authorOf(found);
		}),
	create: (input: AuthorInput) =>
		api
			.post<ServerAccount>("/admin/users", {
				username: input.username,
				displayName: input.displayName,
				email: input.email,
				role: input.role,
				password: input.password,
			})
			.then(async (created) =>
				input.about || input.avatarUrl || input.website
					? authorOf(await api.patch<ServerAccount>(userPath(String(created.id)), { bio: input.about, avatarUrl: input.avatarUrl, website: input.website }))
					: authorOf(created),
			),
	update: (id: string, input: AuthorInput) =>
		api
			.patch<ServerAccount>(userPath(id), {
				displayName: input.displayName,
				email: input.email,
				role: input.role,
				bio: input.about,
				avatarUrl: input.avatarUrl,
				website: input.website,
				...(input.password ? { password: input.password } : {}),
			})
			.then(authorOf),
	setDisabled: (id: string, disabled: boolean) => api.patch<ServerAccount>(userPath(id), { disabled }).then(authorOf),
	clearPasskeys: (id: string) => api.post<{ removed: number }>(`${userPath(id)}/passkeys/clear`),
	remove: (id: string) => api.delete<void>(userPath(id)),
};
