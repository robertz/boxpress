import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Close from "@mui/icons-material/Close";
import ContentCopy from "@mui/icons-material/ContentCopy";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import UploadOutlined from "@mui/icons-material/UploadOutlined";
import { ApiError, errorMessage } from "../../app/api";
import { boot, isAdmin } from "../../app/boot";
import { MediaGrid } from "../../shared/MediaBrowser";
import { Page, PageHeader } from "../../shared/Page";
import { formatDateTime } from "../../shared/dates";
import { deleteMedia, formatSize, prepareImage, saveAltText, setWebpPreferred, uploadPrepared, webpPreferred, type MediaFile } from "../../shared/media";

function Details({ file, onClose, onChanged }: { file: MediaFile; onClose: () => void; onChanged: () => void }) {
	const [alt, setAlt] = useState(file.alt);
	const [copied, setCopied] = useState(false);
	const [inUse, setInUse] = useState(0);
	const canChange = isAdmin || file.ownerId === boot.user.id;

	const saveAlt = useMutation({ mutationFn: () => saveAltText(file.id, alt), onSuccess: onChanged });
	const remove = useMutation({
		mutationFn: (force: boolean) => deleteMedia(file.id, force),
		onSuccess: () => {
			onChanged();
			onClose();
		},
		onError: (err) => {
			if (err instanceof ApiError && err.status === 409) setInUse(Number(err.data.usage ?? 1));
		},
	});

	async function copy() {
		await navigator.clipboard.writeText(new URL(file.url, window.location.origin).toString());
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1500);
	}

	return (
		<Dialog open onClose={onClose} maxWidth="md" fullWidth>
			<DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
				<Typography variant="h3" component="span" noWrap>
					{file.name || `Image ${file.id}`}
				</Typography>
				<IconButton onClick={onClose} aria-label="Close" size="small">
					<Close />
				</IconButton>
			</DialogTitle>
			<DialogContent dividers>
				<Stack direction={{ xs: "column", md: "row" }} spacing={3}>
					<Box sx={{ flex: 1, minWidth: 0, bgcolor: "background.raised", borderRadius: 2, display: "grid", placeItems: "center", p: 1 }}>
						<Box component="img" src={file.url} alt={file.alt} sx={{ maxWidth: "100%", maxHeight: 420, display: "block" }} />
					</Box>
					<Stack spacing={2} sx={{ width: { md: 300 }, flexShrink: 0 }}>
						<Box>
							<Typography variant="body2" color="text.secondary">
								{file.width}×{file.height} · {formatSize(file.bytes)} · {file.contentType.replace("image/", "").toUpperCase()}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								Uploaded by {file.ownerName || "someone"} · {formatDateTime(file.createdAt)}
							</Typography>
						</Box>
						<Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
							<TextField size="small" value={file.url} fullWidth slotProps={{ htmlInput: { readOnly: true, "aria-label": "Address" } }} />
							<Tooltip title={copied ? "Copied" : "Copy address"}>
								<IconButton onClick={copy} aria-label="Copy address">
									<ContentCopy fontSize="small" />
								</IconButton>
							</Tooltip>
						</Stack>
						<TextField
							label="Alt text"
							multiline
							minRows={2}
							value={alt}
							disabled={!canChange}
							helperText="What the image shows, for people who can't see it. Filled in when it's inserted into a post."
							onChange={(e) => setAlt(e.target.value)}
							slotProps={{ htmlInput: { maxLength: 500 } }}
						/>
						{saveAlt.isError && <Alert severity="error">{errorMessage(saveAlt.error, "Couldn't save the alt text.")}</Alert>}
						{inUse > 0 && (
							<Alert severity="warning">
								{inUse === 1 ? "A post shows" : `${inUse} posts show`} this image. Deleting it leaves {inUse === 1 ? "that post" : "them"} with a broken image.
							</Alert>
						)}
						{remove.isError && !(remove.error instanceof ApiError && remove.error.status === 409) && (
							<Alert severity="error">{errorMessage(remove.error, "Couldn't delete the image.")}</Alert>
						)}
					</Stack>
				</Stack>
			</DialogContent>
			{canChange && (
				<DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
					<Button
						color="error"
						startIcon={<DeleteOutline />}
						disabled={remove.isPending}
						onClick={() => remove.mutate(inUse > 0)}
					>
						{inUse > 0 ? "Delete anyway" : "Delete"}
					</Button>
					<Button variant="contained" disabled={saveAlt.isPending || alt === file.alt} onClick={() => saveAlt.mutate()}>
						Save alt text
					</Button>
				</DialogActions>
			)}
		</Dialog>
	);
}

export function MediaPage() {
	const queryClient = useQueryClient();
	const fileInput = useRef<HTMLInputElement>(null);
	const [page, setPage] = useState(1);
	const [q, setQ] = useState("");
	const [mine, setMine] = useState(false);
	const [webp, setWebp] = useState(webpPreferred);
	const [selected, setSelected] = useState<MediaFile | null>(null);
	const [uploading, setUploading] = useState(0);
	const [failures, setFailures] = useState<string[]>([]);

	async function upload(files: FileList | null) {
		if (!files?.length) return;
		const list = Array.from(files);
		setFailures([]);
		setUploading(list.length);
		for (const file of list) {
			try {
				await uploadPrepared(await prepareImage(file, webp));
			} catch (err) {
				setFailures((current) => [...current, `${file.name}: ${errorMessage(err, "upload failed")}`]);
			}
			setUploading((n) => n - 1);
		}
		if (fileInput.current) fileInput.current.value = "";
		setPage(1);
		queryClient.invalidateQueries({ queryKey: ["media"] });
	}

	return (
		<Page>
			<PageHeader
				title="Media"
				subtitle="Images for covers and posts. Uploads lose their location and camera details on the way in."
				actions={
					<>
						<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => upload(e.target.files)} />
						<Button
							variant="contained"
							startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <UploadOutlined />}
							disabled={uploading > 0}
							onClick={() => fileInput.current?.click()}
						>
							{uploading ? `Uploading ${uploading}…` : "Upload"}
						</Button>
					</>
				}
			/>
			<Paper sx={{ p: 2, mb: 2 }}>
				<Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
					<TextField
						size="small"
						placeholder="Search by name or alt text"
						value={q}
						onChange={(e) => {
							setQ(e.target.value);
							setPage(1);
						}}
						sx={{ flex: 1 }}
					/>
					<FormControlLabel
						control={
							<Switch
								checked={mine}
								onChange={(e) => {
									setMine(e.target.checked);
									setPage(1);
								}}
							/>
						}
						label="Only mine"
					/>
					<Tooltip title="Photos are resized to 1600px wide, and converted to WebP when that makes them smaller.">
						<FormControlLabel
							control={
								<Switch
									checked={webp}
									onChange={(e) => {
										setWebp(e.target.checked);
										setWebpPreferred(e.target.checked);
									}}
								/>
							}
							label="Convert to WebP"
						/>
					</Tooltip>
				</Stack>
			</Paper>
			{failures.length > 0 && (
				<Alert severity="error" sx={{ mb: 2 }} onClose={() => setFailures([])}>
					{failures.map((line) => (
						<div key={line}>{line}</div>
					))}
				</Alert>
			)}
			<MediaGrid page={page} q={q.trim()} mine={mine} selectedId={selected?.id} onPage={setPage} onImage={setSelected} />
			{selected && (
				<Details
					key={selected.id}
					file={selected}
					onClose={() => setSelected(null)}
					onChanged={() => queryClient.invalidateQueries({ queryKey: ["media"] })}
				/>
			)}
		</Page>
	);
}
