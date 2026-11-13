import { useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import Refresh from "@mui/icons-material/Refresh";
import { api, errorMessage } from "../../app/api";
import { AdminOnly } from "../../shared/AdminOnly";
import { Card } from "../../shared/cards";
import { Page, PageHeader } from "../../shared/Page";
import { SystemTabs } from "./SystemTabs";
import { TimeChart } from "./TimeChart";

/** GET /api/admin/server: server/services/ServerMonitor.bx snapshot() and ServerHistory.bx recent(). */
interface Snapshot {
	boxlangVersion: string;
	memory: {
		heapUsed: number;
		heapCommitted: number;
		heapMax: number;
		nonHeapUsed: number;
		oldGenAfterLastGc: number | null;
		pools: { name: string; used: number; committed: number; max: number | null; usedAfterLastGc: number | null }[];
		direct: { buffers: number; used: number; capacity: number; max: number | null } | null;
	};
	cpu: {
		processors: number;
		physicalMemoryTotal: number | null;
		physicalMemoryFree: number | null;
		averageLoad?: number;
		recentLoad?: number;
		recentSeconds?: number;
	};
	disk: { total: number; free: number; usable: number };
	jvm: { vmName: string; javaVersion: string; startedAt: string; uptimeSeconds: number; loadedClasses: number; jvmArguments: string[] };
	collectors: { name: string; collections: number; timeMs: number }[];
	fullGcCauses: { cause: string; collections: number; timeMs: number }[];
	threads: {
		live: number;
		peak: number;
		daemon: number;
		started: number;
		deadlocked: string[];
		busiest: { name: string; state: string; cpuSeconds: number; recentLoad: number | null }[];
	};
	files: { open: number; max: number | null } | null;
	http: {
		requests: number;
		errors: number;
		activeRequests: number;
		maxActiveRequests: number;
		activeConnections: number;
		maxActiveConnections: number;
		bytesSent: number;
		bytesReceived: number;
	} | null;
	routes: { route: string; requests: number; clientErrors: number; serverErrors: number; averageMs: number; slowestMs: number; open: number }[];
	database: { pools: number; active: number; idle: number; total: number; waiting: number; max: number } | null;
	mysql: {
		version: string;
		uptimeSeconds: number;
		bufferPoolBytes: number;
		bufferPoolDataBytes: number;
		hitRate: number | null;
		recentHitRate?: number | null;
		queries: number;
		slowQueries: number;
		longQuerySeconds: number;
		threadsConnected: number;
		threadsRunning: number;
		maxConnections: number;
		tmpTables: number;
		tmpDiskTables: number;
		tables: { name: string; rows: number; dataBytes: number; indexBytes: number }[];
	} | null;
	requestLogQueued: number;
}

interface HourRecord {
	recordedAt: string;
	heapMax: number;
	oldGenAfterGc: number | null;
	cpuLoadHour: number | null;
	fullGcsHour: number | null;
	httpRequestsHour: number | null;
	httpErrorsHour: number | null;
	openFiles: number | null;
}

const REFRESH_MS = 30_000;

const RANGES = [
	{ hours: 24, label: "24 hours" },
	{ hours: 48, label: "2 days" },
	{ hours: 24 * 7, label: "7 days" },
	{ hours: 24 * 30, label: "30 days" },
];

type Maybe<T> = T | null | undefined;
const bytes = (n: Maybe<number>) => {
	if (n === null || n === undefined || n < 0) return "—";
	if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
	if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
	if (n >= 1024) return `${Math.round(n / 1024)} KB`;
	return `${n} B`;
};
const percent = (f: Maybe<number>, digits = 0) => (f === null || f === undefined || f < 0 ? "—" : `${(f * 100).toFixed(digits)}%`);
const count = (n: Maybe<number>) => (n === null || n === undefined ? "—" : Math.round(n).toLocaleString());
const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} s` : n < 10 ? `${n.toFixed(1)} ms` : `${Math.round(n)} ms`);
const duration = (seconds: number) => {
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

/** The running server now, read every 30 seconds, and its hourly records charted. */
function Server() {
	const [hours, setHours] = useState(48);
	const query = useQuery({
		queryKey: ["server", hours],
		queryFn: () => api.get<{ snapshot: Snapshot; history: HourRecord[] }>(`/admin/server?hours=${hours}`),
		refetchInterval: REFRESH_MS,
		placeholderData: keepPreviousData,
	});

	return (
		<Page>
			<PageHeader
				eyebrow="Admin"
				title="System"
				subtitle={query.dataUpdatedAt ? `Read ${new Date(query.dataUpdatedAt).toLocaleTimeString()} · every 30 seconds` : "The running server."}
				actions={
					<Button variant="outlined" startIcon={<Refresh />} onClick={() => void query.refetch()} disabled={query.isFetching}>
						Refresh
					</Button>
				}
			/>
			<SystemTabs value="server" />
			{query.isPending && <Skeleton variant="rounded" height={480} />}
			{query.isError && <Alert severity="error">{errorMessage(query.error, "Couldn't read the server.")}</Alert>}
			{query.data && (
				<Stack spacing={3}>
					<Tiles s={query.data.snapshot} />
					<Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
						<Typography variant="h2">Over time</Typography>
						<ToggleButtonGroup size="small" exclusive value={hours} onChange={(_e, next) => next && setHours(next)} aria-label="Range">
							{RANGES.map((r) => (
								<ToggleButton key={r.hours} value={r.hours}>
									{r.label}
								</ToggleButton>
							))}
						</ToggleButtonGroup>
					</Stack>
					<Charts history={query.data.history} />
					<Routes s={query.data.snapshot} />
					<Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, alignItems: "start" }}>
						<Memory s={query.data.snapshot} />
						<Collection s={query.data.snapshot} />
						<Threads s={query.data.snapshot} />
						<Database s={query.data.snapshot} />
					</Box>
					<Runtime s={query.data.snapshot} />
				</Stack>
			)}
		</Page>
	);
}

function Tiles({ s }: { s: Snapshot }) {
	const tiles: [string, ReactNode, ReactNode?, boolean?][] = [
		["Up", duration(s.jvm.uptimeSeconds), `since ${new Date(s.jvm.startedAt).toLocaleString()}`],
		["Heap", bytes(s.memory.heapUsed), `of ${bytes(s.memory.heapMax)} (${percent(s.memory.heapUsed / s.memory.heapMax)})`],
		["After last full GC", bytes(s.memory.oldGenAfterLastGc), "what garbage collection can’t free"],
		[
			"CPU",
			percent(s.cpu.recentLoad ?? s.cpu.averageLoad),
			s.cpu.recentLoad !== undefined ? `last ${s.cpu.recentSeconds}s of ${s.cpu.processors} CPUs` : `average, ${s.cpu.processors} CPUs`,
		],
		["Requests", count(s.http?.requests), s.http ? `${count(s.http.errors)} errors · ${s.http.activeRequests} now` : "not listening"],
		["Threads", count(s.threads.live), s.threads.deadlocked.length ? `${s.threads.deadlocked.length} deadlocked` : `peak ${s.threads.peak}`, s.threads.deadlocked.length > 0],
		["Open files", s.files ? count(s.files.open) : "—", s.files?.max ? `of ${count(s.files.max)}` : undefined],
		["Disk free", bytes(s.disk.usable), `of ${bytes(s.disk.total)}`],
		["Access log queue", count(s.requestLogQueued), "requests waiting to be written"],
	];
	return (
		<Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
			{tiles.map(([label, value, note, warn]) => (
				<Paper key={label} sx={{ p: 2, borderColor: warn ? "warning.main" : undefined }}>
					<Typography variant="caption" color="text.secondary">
						{label}
					</Typography>
					<Typography sx={{ fontSize: "1.375rem", fontWeight: 700, lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
					{note && (
						<Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
							{note}
						</Typography>
					)}
				</Paper>
			))}
		</Box>
	);
}

function Charts({ history }: { history: HourRecord[] }) {
	const series = (pick: (r: HourRecord) => number | null) => history.map((r) => ({ t: r.recordedAt, v: pick(r) }));
	const heapMax = history.length ? history[history.length - 1].heapMax : undefined;
	if (!history.length) {
		return <Alert severity="info">The server records itself once an hour; the charts fill in from the first record.</Alert>;
	}
	return (
		<Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" } }}>
			<TimeChart
				title="Memory in use after garbage collection"
				points={series((r) => r.oldGenAfterGc)}
				format={bytes}
				reference={heapMax ? { value: heapMax, label: "heap cap" } : undefined}
			/>
			<TimeChart title="CPU load (per hour)" points={series((r) => r.cpuLoadHour)} format={(v) => percent(v)} max={1} />
			<TimeChart title="Requests per hour" whole points={series((r) => r.httpRequestsHour)} kind="bar" format={count} />
			<TimeChart title="Server errors per hour" whole points={series((r) => r.httpErrorsHour)} kind="bar" format={count} />
			<TimeChart title="Full garbage collections per hour" whole points={series((r) => r.fullGcsHour)} kind="bar" format={count} />
			<TimeChart title="Open files" whole points={series((r) => r.openFiles)} format={count} />
		</Box>
	);
}

function Routes({ s }: { s: Snapshot }) {
	const [all, setAll] = useState(false);
	const shown = all ? s.routes : s.routes.slice(0, 12);
	return (
		<Card title="Requests by route since start">
			<Box sx={{ overflowX: "auto" }}>
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>Route</TableCell>
							<TableCell align="right">Requests</TableCell>
							<TableCell align="right">4xx</TableCell>
							<TableCell align="right">5xx</TableCell>
							<TableCell align="right">Average</TableCell>
							<TableCell align="right">Slowest</TableCell>
							<TableCell align="right">Open</TableCell>
						</TableRow>
					</TableHead>
					<TableBody sx={{ "& td": { fontVariantNumeric: "tabular-nums" } }}>
						{shown.map((r) => (
							<TableRow key={r.route}>
								<TableCell sx={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.8125rem" }}>{r.route}</TableCell>
								<TableCell align="right">{count(r.requests)}</TableCell>
								<TableCell align="right">{count(r.clientErrors)}</TableCell>
								<TableCell align="right" sx={{ color: r.serverErrors ? "error.main" : undefined }}>
									{count(r.serverErrors)}
								</TableCell>
								<TableCell align="right">{ms(r.averageMs)}</TableCell>
								<TableCell align="right">{ms(r.slowestMs)}</TableCell>
								<TableCell align="right">{count(r.open)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</Box>
			{s.routes.length > 12 && (
				<Button size="small" onClick={() => setAll((a) => !a)} sx={{ alignSelf: "flex-start", mt: 1 }}>
					{all ? "Show fewer" : `Show all ${s.routes.length}`}
				</Button>
			)}
		</Card>
	);
}

/** A titled card of label · value rows. */
function Facts({ title, rows, children }: { title: string; rows: [string, ReactNode][]; children?: ReactNode }) {
	return (
		<Card title={title}>
			<Box component="dl" sx={{ m: 0 }}>
				{rows.map(([label, value]) => (
					<Stack
						key={label}
						direction="row"
						spacing={2}
						sx={{ justifyContent: "space-between", py: 0.75, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } }}
					>
						<Typography component="dt" variant="body2" color="text.secondary" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
							{label}
						</Typography>
						<Typography component="dd" variant="body2" sx={{ m: 0, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
							{value}
						</Typography>
					</Stack>
				))}
			</Box>
			{children}
		</Card>
	);
}

function Memory({ s }: { s: Snapshot }) {
	const m = s.memory;
	return (
		<Facts
			title="Memory"
			rows={[
				["Heap used", `${bytes(m.heapUsed)} of ${bytes(m.heapMax)}`],
				["Heap committed", bytes(m.heapCommitted)],
				["Outside the heap", bytes(m.nonHeapUsed)],
				["Direct buffers", m.direct ? `${bytes(m.direct.used)} in ${count(m.direct.buffers)}${m.direct.max ? ` of ${bytes(m.direct.max)}` : ""}` : "—"],
				["Container memory free", s.cpu.physicalMemoryTotal ? `${bytes(s.cpu.physicalMemoryFree)} of ${bytes(s.cpu.physicalMemoryTotal)}` : "—"],
				...m.pools.map((p): [string, ReactNode] => [p.name, `${bytes(p.used)}${p.usedAfterLastGc !== null ? ` · ${bytes(p.usedAfterLastGc)} after GC` : ""}`]),
			]}
		/>
	);
}

function Collection({ s }: { s: Snapshot }) {
	return (
		<Facts
			title="Garbage collection"
			rows={[
				...s.collectors.map((c): [string, ReactNode] => [c.name, `${count(c.collections)} · ${ms(c.timeMs)}`]),
				...s.fullGcCauses.map((c): [string, ReactNode] => [`Full GC: ${c.cause}`, `${count(c.collections)} · ${ms(c.timeMs)}`]),
			]}
		>
			{!s.fullGcCauses.length && (
				<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
					No full collections since start.
				</Typography>
			)}
		</Facts>
	);
}

function Threads({ s }: { s: Snapshot }) {
	const t = s.threads;
	return (
		<Facts
			title="Threads"
			rows={[
				["Live", `${count(t.live)} (${count(t.daemon)} daemon)`],
				["Peak", count(t.peak)],
				["Started since start", count(t.started)],
				["Deadlocked", t.deadlocked.length ? t.deadlocked.join(", ") : "none"],
				...t.busiest.map((b): [string, ReactNode] => [
					b.name,
					`${b.recentLoad !== null ? percent(b.recentLoad, 1) : `${b.cpuSeconds.toFixed(1)} s`} · ${b.state.toLowerCase()}`,
				]),
			]}
		/>
	);
}

function Database({ s }: { s: Snapshot }) {
	const db = s.mysql;
	if (!db) return <Facts title="MySQL" rows={[["Status", "MySQL didn’t say (no privilege, or not MySQL)"]]} />;
	return (
		<Facts
			title="MySQL"
			rows={[
				["Version", db.version],
				["Up", duration(db.uptimeSeconds)],
				["Buffer pool", `${bytes(db.bufferPoolDataBytes)} of ${bytes(db.bufferPoolBytes)} holds data`],
				["Reads from memory", `${percent(db.hitRate, 2)}${db.recentHitRate != null ? ` · ${percent(db.recentHitRate, 2)} lately` : ""}`],
				["Connections", `${count(db.threadsConnected)} of ${count(db.maxConnections)} (${db.threadsRunning} running)`],
				["Pool here", s.database ? `${s.database.active} active, ${s.database.idle} idle of ${s.database.max}` : "—"],
				["Queries", count(db.queries)],
				["Slow queries", `${count(db.slowQueries)} (over ${db.longQuerySeconds} s)`],
				["Temporary tables on disk", `${count(db.tmpDiskTables)} of ${count(db.tmpTables)}`],
			]}
		>
			<Box sx={{ overflowX: "auto", mt: 1 }}>
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>Table</TableCell>
							<TableCell align="right">Rows</TableCell>
							<TableCell align="right">Data</TableCell>
							<TableCell align="right">Indexes</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{db.tables.map((t) => (
							<TableRow key={t.name}>
								<TableCell>{t.name}</TableCell>
								<TableCell align="right">{count(t.rows)}</TableCell>
								<TableCell align="right">{bytes(t.dataBytes)}</TableCell>
								<TableCell align="right">{bytes(t.indexBytes)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</Box>
			<Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
				Row counts and sizes are MySQL's estimates.
			</Typography>
		</Facts>
	);
}

function Runtime({ s }: { s: Snapshot }) {
	return (
		<Facts
			title="Runtime"
			rows={[
				["BoxLang", s.boxlangVersion || "—"],
				["Java", `${s.jvm.javaVersion} · ${s.jvm.vmName}`],
				["Started", new Date(s.jvm.startedAt).toLocaleString()],
				["Classes loaded", count(s.jvm.loadedClasses)],
				[
					"HTTP",
					s.http ? `${count(s.http.activeConnections)} connections now, ${count(s.http.maxActiveConnections)} at most · ${bytes(s.http.bytesSent)} sent` : "—",
				],
			]}
		>
			<Box component="details" sx={{ mt: 1 }}>
				<Typography component="summary" variant="body2" sx={{ cursor: "pointer" }}>
					JVM options
				</Typography>
				<Box component="pre" sx={{ fontSize: "0.75rem", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
					{s.jvm.jvmArguments.join("\n")}
				</Box>
			</Box>
		</Facts>
	);
}

export function SystemPage() {
	return (
		<AdminOnly>
			<Server />
		</AdminOnly>
	);
}
