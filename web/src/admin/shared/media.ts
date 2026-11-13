import { api } from "../app/api";

/** An image in the media library (server/services/Media.bx). */
export interface MediaFile {
	id: number;
	url: string;
	name: string;
	alt: string;
	width: number;
	height: number;
	bytes: number;
	contentType: string;
	ownerId: number;
	ownerName: string;
	// ISO 8601, UTC
	createdAt: string;
}

export interface MediaPage {
	items: MediaFile[];
	total: number;
	page: number;
	pageSize: number;
}

export function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function listMedia(page = 1, q = "", mine = false, pageSize = 48): Promise<MediaPage> {
	const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
	if (q) params.set("q", q);
	if (mine) params.set("mine", "true");
	return api.get<MediaPage>(`/media?${params}`);
}

const WEBP_KEY = "boxpress:admin:webp";

/** Whether uploads are converted to WebP. On unless switched off on the Media page. */
export function webpPreferred(): boolean {
	try {
		return localStorage.getItem(WEBP_KEY) !== "0";
	} catch {
		return true;
	}
}

export function setWebpPreferred(on: boolean) {
	try {
		localStorage.setItem(WEBP_KEY, on ? "1" : "0");
	} catch {}
}

function loadImage(file: File): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const objectUrl = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(objectUrl);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			resolve(null);
		};
		img.src = objectUrl;
	});
}

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob(resolve, type, 0.9));
}

/**
 * Gets a file ready to store: downscaled to 1600px wide, and converted to
 * WebP when that's switched on and actually comes out smaller.
 *
 * 1600px covers a 2x display at full column width; anything larger is wasted
 * bytes. GIFs pass through untouched, because a canvas would flatten them to
 * their first frame. A file the browser can't decode is returned as it is,
 * for the server's own type check to reject.
 */
export async function prepareImage(file: File, webp = webpPreferred(), maxWidth = 1600): Promise<File> {
	if (!TYPE_EXT[file.type.toLowerCase()] || file.type === "image/gif") return file;
	const img = await loadImage(file);
	if (!img) return file;

	const tooWide = img.width > maxWidth;
	const wantsWebp = webp && file.type !== "image/webp";
	if (!tooWide && !wantsWebp) return file;

	const canvas = document.createElement("canvas");
	canvas.width = tooWide ? maxWidth : img.width;
	canvas.height = tooWide ? Math.round(img.height * (maxWidth / img.width)) : img.height;
	canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);

	if (wantsWebp) {
		// A browser that can't encode WebP hands back a PNG instead.
		const converted = await encode(canvas, "image/webp");
		if (converted && converted.type === "image/webp" && (tooWide || converted.size < file.size)) {
			return new File([converted], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
		}
	}
	if (!tooWide) return file;
	const resized = await encode(canvas, file.type);
	return resized ? new File([resized], file.name, { type: file.type }) : file;
}

const TYPE_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/** Uploads a file exactly as given; answers the stored image. */
export function uploadPrepared(file: File): Promise<MediaFile> {
	return api.upload<MediaFile>(`/media?name=${encodeURIComponent(file.name)}`, file);
}

/** Prepares (see prepareImage()) and uploads in one step; answers the image's address. */
export async function uploadImage(file: File): Promise<string> {
	return (await uploadPrepared(await prepareImage(file))).url;
}

export function saveAltText(id: number, alt: string): Promise<MediaFile> {
	return api.patch<MediaFile>(`/media/${id}`, { alt });
}

/**
 * Permanent. Without force the server refuses an image that posts still
 * show, answering 409 with { usage }, the number of them.
 */
export function deleteMedia(id: number, force = false): Promise<void> {
	return api.delete<void>(`/media/${id}${force ? "?force=true" : ""}`);
}
