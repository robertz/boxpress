import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Close from "@mui/icons-material/Close";
import UploadOutlined from "@mui/icons-material/UploadOutlined";
import { errorMessage } from "../app/api";
import { MediaGrid } from "./MediaBrowser";
import { prepareImage, uploadPrepared } from "./media";

interface Props {
	open: boolean;
	title: string;
	// `alt` is the image's stored alt text, "" when it has none.
	onPick: (url: string, filename: string, alt: string) => void;
	onClose: () => void;
}

export function ImagePicker({ open, title, onPick, onClose }: Props) {
	const [page, setPage] = useState(1);
	const [q, setQ] = useState("");
	const [failure, setFailure] = useState("");
	const [busy, setBusy] = useState(false);
	const fileInput = useRef<HTMLInputElement>(null);
	const queryClient = useQueryClient();

	async function handleUpload(file: File | undefined) {
		if (!file) return;
		setBusy(true);
		setFailure("");
		try {
			const stored = await uploadPrepared(await prepareImage(file));
			queryClient.invalidateQueries({ queryKey: ["media"] });
			onPick(stored.url, stored.name, stored.alt);
		} catch (err) {
			setFailure(errorMessage(err, "Upload failed. Check your connection and try again."));
		} finally {
			setBusy(false);
			if (fileInput.current) fileInput.current.value = "";
		}
	}

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
			<DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				{title}
				<IconButton onClick={onClose} aria-label="Close" size="small">
					<Close />
				</IconButton>
			</DialogTitle>
			<DialogContent dividers sx={{ minHeight: 360 }}>
				<Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2, flexWrap: "wrap" }} useFlexGap>
					<input
						ref={fileInput}
						type="file"
						accept="image/jpeg,image/png,image/webp,image/gif"
						hidden
						onChange={(e) => handleUpload(e.target.files?.[0])}
					/>
					<Button
						variant="outlined"
						startIcon={busy ? <CircularProgress size={16} /> : <UploadOutlined />}
						disabled={busy}
						onClick={() => fileInput.current?.click()}
					>
						Upload new
					</Button>
					<TextField
						size="small"
						placeholder="Search by name or alt text"
						value={q}
						onChange={(e) => {
							setQ(e.target.value);
							setPage(1);
						}}
						sx={{ flex: 1, minWidth: 200 }}
					/>
				</Stack>

				{failure && (
					<Alert severity="error" sx={{ mb: 2 }}>
						{failure}
					</Alert>
				)}

				<MediaGrid page={page} q={q.trim()} enabled={open} onPage={setPage} onImage={(file) => onPick(file.url, file.name, file.alt)} />
			</DialogContent>
		</Dialog>
	);
}
