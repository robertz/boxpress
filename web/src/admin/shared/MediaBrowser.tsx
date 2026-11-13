import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import CircularProgress from "@mui/material/CircularProgress";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { errorMessage } from "../app/api";
import { formatSize, listMedia, type MediaFile } from "./media";

const tileSx = {
	display: "flex",
	flexDirection: "column",
	alignItems: "stretch",
	justifyContent: "flex-start",
	border: 1,
	borderColor: "divider",
	borderRadius: 2,
	overflow: "hidden",
	bgcolor: "background.raised",
	textAlign: "left",
	"&:hover": { borderColor: "primary.main" },
	"&.Mui-selected": { borderColor: "primary.main", boxShadow: (theme: { palette: { primary: { main: string } } }) => `0 0 0 2px ${theme.palette.primary.main}` },
};

export function mediaQueryKey(page: number, q: string, mine: boolean) {
	return ["media", page, q, mine];
}

interface Props {
	page: number;
	q?: string;
	mine?: boolean;
	enabled?: boolean;
	selectedId?: number;
	onPage: (page: number) => void;
	onImage: (file: MediaFile) => void;
}

/** A page of the media library as tiles, newest first. */
export function MediaGrid({ page, q = "", mine = false, enabled = true, selectedId, onPage, onImage }: Props) {
	const listing = useQuery({
		queryKey: mediaQueryKey(page, q, mine),
		queryFn: () => listMedia(page, q, mine),
		placeholderData: keepPreviousData,
		enabled,
	});

	if (listing.isPending) {
		return (
			<Stack sx={{ alignItems: "center", py: 6 }}>
				<CircularProgress />
			</Stack>
		);
	}
	if (listing.isError) {
		return <Alert severity="error">{errorMessage(listing.error, "Couldn't load the media library.")}</Alert>;
	}

	const { items, total, pageSize } = listing.data;
	if (items.length === 0) {
		return <Typography color="text.secondary">{q ? "No images match." : "No images yet. Upload one to start the library."}</Typography>;
	}

	return (
		<>
			<Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
				{items.map((file) => (
					<ButtonBase key={file.id} sx={tileSx} className={file.id === selectedId ? "Mui-selected" : undefined} onClick={() => onImage(file)}>
						<Box
							component="img"
							src={file.url}
							alt={file.alt || file.name}
							loading="lazy"
							sx={{ width: "100%", height: 100, objectFit: "cover", display: "block" }}
						/>
						<Box sx={{ p: 1, minWidth: 0 }}>
							<Typography variant="caption" noWrap sx={{ display: "block" }} title={file.name}>
								{file.name || `Image ${file.id}`}
							</Typography>
							<Typography variant="caption" color="text.secondary">
								{file.width}×{file.height} · {formatSize(file.bytes)}
							</Typography>
						</Box>
					</ButtonBase>
				))}
			</Box>
			{total > pageSize && (
				<Stack sx={{ alignItems: "center", mt: 2 }}>
					<Pagination count={Math.ceil(total / pageSize)} page={page} onChange={(_e, next) => onPage(next)} />
				</Stack>
			)}
		</>
	);
}
