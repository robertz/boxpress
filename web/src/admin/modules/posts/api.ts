import { api } from "../../app/api";

export interface PostSummary {
	id: string;
	title: string;
	slug: string;
	status: string;
	featured: boolean;
	publishDate: string;
	isScheduled: boolean;
	postUrl: string;
	tags: string[];
	authorName: string;
	views: number;
}

export interface Post extends PostSummary {
	description: string;
	coverImage: string;
	body: string;
}

export interface PostPage {
	posts: PostSummary[];
	total: number;
	page: number;
	totalPages: number;
}

export interface PostInput {
	title: string;
	slug: string;
	description: string;
	coverImage: string;
	body: string;
	status: string;
	featured: boolean;
	publishDate: string;
	tags: string[];
}

export interface RevisionSummary {
	id: number;
	kind: "save" | "autosave";
	created: string;
	userName: string;
	title: string;
	words: number;
}

export interface Revision {
	id: number;
	kind: "save" | "autosave";
	created: string;
	title: string;
	description: string;
	coverImage: string;
	body: string;
	tags: string[];
}

export interface CalendarPost {
	id: string;
	title: string;
	status: string;
	publishDate: string;
	isScheduled: boolean;
}

export interface CalendarMonth {
	month: string;
	posts: CalendarPost[];
	drafts: { id: string; title: string }[];
}

// What the server sends (server/services/Posts.bx view()); mapped onto the shapes above.
interface ServerPost {
	id: number;
	authorId: number;
	title: string;
	slug: string;
	url: string;
	excerpt: string;
	coverImage: string;
	status: "draft" | "scheduled" | "published";
	featured: boolean;
	publishedAt: string;
	updatedAt: string;
	tags: { name: string; slug: string }[];
	author: { displayName: string };
	views?: number;
	body?: string;
}

interface ServerRevision {
	id: number;
	kind: "save" | "autosave";
	createdAt: string;
	title: string;
	excerpt: string;
	coverImage: string;
	body: string;
	tags: string[];
}

function summaryOf(post: ServerPost): PostSummary {
	return {
		id: String(post.id),
		title: post.title,
		slug: post.slug,
		status: post.status === "draft" ? "draft" : "published",
		featured: post.featured,
		publishDate: post.publishedAt,
		isScheduled: post.status === "scheduled",
		postUrl: post.url,
		tags: post.tags.map((tag) => tag.name),
		authorName: post.author.displayName,
		views: post.views ?? 0,
	};
}

function postOf(post: ServerPost): Post {
	return { ...summaryOf(post), description: post.excerpt, coverImage: post.coverImage, body: post.body ?? "" };
}

function payloadOf(input: PostInput) {
	return {
		title: input.title,
		slug: input.slug,
		excerpt: input.description,
		coverImage: input.coverImage,
		body: input.body,
		status: input.status,
		featured: input.featured,
		publishedAt: input.publishDate,
		tags: input.tags,
	};
}

const postPath = (id: string) => `/posts/${encodeURIComponent(id)}`;


// Only a draft can be deleted from the list; a published post is unpublished first.
export function canDelete(post: Pick<PostSummary, "status">): boolean {
	return post.status !== "published";
}

export const postsApi = {
	list: (page: number) =>
		api
			.get<{ posts: ServerPost[]; total: number; page: number; totalPages: number }>(`/posts?page=${page}`)
			.then((r): PostPage => ({ ...r, posts: r.posts.map(summaryOf) })),
	get: (id: string) => api.get<ServerPost>(postPath(id)).then(postOf),
	create: (input: PostInput) => api.post<ServerPost>("/posts", payloadOf(input)).then(postOf),
	update: (id: string, input: PostInput) => api.put<ServerPost>(postPath(id), payloadOf(input)).then(postOf),
	remove: (id: string) => api.delete<void>(postPath(id)),
	toggleFeatured: async (id: string) => {
		const current = await api.get<ServerPost>(postPath(id));
		const saved = await api.put<ServerPost>(postPath(id), { featured: !current.featured });
		return { featured: saved.featured };
	},
	tags: () => api.get<{ name: string }[]>("/tags").then((tags) => tags.map((tag) => tag.name)),
	search: (text: string) =>
		api
			.get<{ posts: ServerPost[] }>(`/posts?q=${encodeURIComponent(text)}&pageSize=10`)
			.then((r) => r.posts.map((post) => ({ id: String(post.id), title: post.title, status: post.status }))),
	// from/to are the month's bounds in the browser's time zone, as UTC.
	calendar: (month: string, from: string, to: string) =>
		api
			.get<{ posts: ServerPost[]; drafts: { id: number; title: string }[] }>(
				`/posts/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
			)
			.then(
				(r): CalendarMonth => ({
					month,
					posts: r.posts.map((post) => ({
						id: String(post.id),
						title: post.title,
						status: "published",
						publishDate: post.publishedAt,
						isScheduled: post.status === "scheduled",
					})),
					drafts: r.drafts.map((draft) => ({ id: String(draft.id), title: draft.title })),
				}),
			),
	// Publishes the post at this time: a time ahead schedules it.
	schedule: (id: string, publishDate: string) =>
		api.put<ServerPost>(postPath(id), { status: "published", publishedAt: publishDate }).then(summaryOf),
	// Keeps unsaved work on the server without changing the post.
	autosave: (id: string, input: PostInput) => api.put<void>(`${postPath(id)}/autosave`, payloadOf(input)).then(() => true),
	revisions: (id: string) =>
		api.get<(Omit<RevisionSummary, "created"> & { createdAt: string })[]>(`${postPath(id)}/revisions`).then((rows) => ({
			available: true,
			revisions: rows.map(({ createdAt, ...rest }): RevisionSummary => ({ ...rest, created: createdAt })),
		})),
	revision: (id: string, revisionId: number) =>
		api.get<ServerRevision>(`${postPath(id)}/revisions/${revisionId}`).then(
			(r): Revision => ({
				id: r.id,
				kind: r.kind,
				created: r.createdAt,
				title: r.title,
				description: r.excerpt,
				coverImage: r.coverImage,
				body: r.body,
				tags: r.tags,
			}),
		),
	preview: (body: string) => api.post<{ html: string }>("/posts/preview", { body }).then((r) => r.html),
};
