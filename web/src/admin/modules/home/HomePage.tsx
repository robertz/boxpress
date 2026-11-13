import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import Add from "@mui/icons-material/Add";
import Schedule from "@mui/icons-material/Schedule";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { api, errorMessage } from "../../app/api";
import { boot, isAdmin } from "../../app/boot";
import { Page, PageHeader } from "../../shared/Page";
import { StatusBadge } from "../../shared/StatusBadge";
import { formatLocalDateTime, formatMonthDay } from "../../shared/dates";
import { ButtonLink, TextLink } from "../../shared/links";
import { Card, CardBody, Empty } from "../../shared/cards";

interface Dashboard {
	contentHealth: { draftCount: number; upcomingCount: number; missingCoverCount: number; missingTagsCount: number };
	recentActivity: { id: string; title: string; status: string; isScheduled: boolean; lastUpdated: string }[];
	statusCounts: { draft: number; scheduled: number; published: number };
	upcoming: { id: string; title: string; publishDate: string }[];
	site: { authors: number; tags: number; media: { files: number; bytes: number } } | null;
}

interface TopPosts {
	posts: { title: string; url: string; views: number }[];
}

// What GET /api/dashboard sends (server/routes/DashboardRoutes.bx).
interface ServerPost {
	id: number;
	title: string;
	status: "draft" | "scheduled" | "published";
	publishedAt: string;
	updatedAt: string;
}
interface ServerDashboard {
	counts: { total: number; published: number; scheduled: number; drafts: number; missingCover: number; missingTags: number };
	recent: ServerPost[];
	upcoming: ServerPost[];
	site?: { authors: number; tags: number; media: { files: number; bytes: number } };
}

async function loadDashboard(): Promise<Dashboard> {
	const d = await api.get<ServerDashboard>("/dashboard");
	return {
		contentHealth: {
			draftCount: d.counts.drafts,
			upcomingCount: d.counts.scheduled,
			missingCoverCount: d.counts.missingCover,
			missingTagsCount: d.counts.missingTags,
		},
		recentActivity: d.recent.map((post) => ({
			id: String(post.id),
			title: post.title,
			status: post.status === "draft" ? "draft" : "published",
			isScheduled: post.status === "scheduled",
			lastUpdated: post.updatedAt,
		})),
		statusCounts: { draft: d.counts.drafts, scheduled: d.counts.scheduled, published: d.counts.published },
		upcoming: d.upcoming.map((post) => ({ id: String(post.id), title: post.title, publishDate: post.publishedAt })),
		site: d.site ?? null,
	};
}

async function loadTopPosts(): Promise<TopPosts> {
	const rows = await api.get<{ label: string; url: string; count: number }[]>("/dashboard/top-posts");
	return { posts: rows.map((row) => ({ title: row.label, url: row.url, views: row.count })) };
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function truncate(text: string, length: number): string {
	return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

/**
 * The content overview. Traffic, top posts and audience live on Insights and
 * server health on System, so each figure has one home; authors can't open
 * Insights, so they get top posts here.
 */
export function HomePage() {
	const theme = useTheme();
	const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: loadDashboard });
	const topPosts = useQuery({ queryKey: ["dashboard", "top-posts"], queryFn: loadTopPosts, enabled: !isAdmin });

	const counts = dashboard.data?.statusCounts;
	const statusSlices = counts
		? [
				{ id: "published", label: "Published", value: counts.published, color: theme.palette.success.main },
				{ id: "draft", label: "Draft", value: counts.draft, color: theme.palette.warning.main },
				{ id: "scheduled", label: "Scheduled", value: counts.scheduled, color: theme.palette.info.main },
			]
		: [];

	return (
		<Page>
			<PageHeader
				title="Dashboard"
				subtitle={`Welcome back, ${boot.user.displayName}.`}
				actions={
					<ButtonLink to="/posts/new" variant="contained" startIcon={<Add />}>
						New post
					</ButtonLink>
				}
			/>

			{dashboard.isError && (
				<Alert severity="error" sx={{ mb: 3 }}>
					{errorMessage(dashboard.error, "Couldn't load the dashboard.")}
				</Alert>
			)}

			<Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, alignItems: "start" }}>
				<Card title="Posts by status">
					<CardBody query={dashboard} height={280}>
						{() => (
							<>
								<PieChart
									height={190}
									hideLegend
									series={[
										{
											data: statusSlices.filter((slice) => slice.value > 0),
											innerRadius: 55,
											outerRadius: 85,
											paddingAngle: 2,
											cornerRadius: 4,
										},
									]}
								/>
								<Stack spacing={0.75} sx={{ mt: 1.5 }}>
									{statusSlices.map((slice) => (
										<Stack key={slice.id} direction="row" spacing={1} sx={{ alignItems: "center" }}>
											<Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: slice.color }} />
											<Typography variant="body2" sx={{ flex: 1 }}>
												{slice.label}
											</Typography>
											<Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
												{slice.value}
											</Typography>
										</Stack>
									))}
								</Stack>
							</>
						)}
					</CardBody>
				</Card>

				<Card title="Needs attention">
					<CardBody query={dashboard} height={220}>
						{(data) => (
							<Stack spacing={1.25}>
								<AttentionRow count={data.contentHealth.draftCount} label="drafts in progress" />
								<AttentionRow count={data.contentHealth.missingCoverCount} label="posts missing a cover image" />
								<AttentionRow count={data.contentHealth.missingTagsCount} label="posts missing tags" />
								<Typography variant="overline" color="text.disabled" sx={{ pt: 1 }}>
									Scheduled next
								</Typography>
								{data.upcoming.length === 0 && <Empty>Nothing scheduled.</Empty>}
								{data.upcoming.map((post) => (
									<Stack key={post.id} direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
										<Schedule fontSize="small" color="info" />
										<TextLink
											to="/posts/$postId/edit"
											params={{ postId: post.id }}
											underline="hover"
											color="text.primary"
											variant="body2"
											noWrap
											sx={{ flex: 1, fontWeight: 600 }}
										>
											{post.title}
										</TextLink>
										<Typography variant="caption" color="text.secondary" noWrap>
											{formatLocalDateTime(post.publishDate)}
										</Typography>
									</Stack>
								))}
							</Stack>
						)}
					</CardBody>
				</Card>

				<Card
					title="Recent activity"
					action={
						<ButtonLink to="/posts" size="small">
							All posts
						</ButtonLink>
					}
				>
					<CardBody query={dashboard} height={220}>
						{(data) =>
							data.recentActivity.length === 0 ? (
								<Empty>No posts yet.</Empty>
							) : (
								<Stack spacing={1.25}>
									{data.recentActivity.map((row) => (
										<Stack key={row.id} direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
											<TextLink
												to="/posts/$postId/edit"
												params={{ postId: row.id }}
												underline="hover"
												color="text.primary"
												variant="body2"
												noWrap
												sx={{ flex: 1, fontWeight: 600 }}
											>
												{row.title}
											</TextLink>
											<StatusBadge status={row.status} isScheduled={row.isScheduled} />
											<Typography variant="caption" color="text.secondary" noWrap sx={{ width: 48, textAlign: "right" }}>
												{formatMonthDay(row.lastUpdated)}
											</Typography>
										</Stack>
									))}
								</Stack>
							)
						}
					</CardBody>
				</Card>

				{isAdmin && <ServerCard />}

				{!isAdmin && <TopPostsCard query={topPosts} sx={{ gridColumn: "1 / -1" }} />}
			</Box>
		</Page>
	);
}

// A glance at the running server for admins; System has the rest.
interface ServerGlance {
	snapshot: {
		jvm: { uptimeSeconds: number };
		memory: { heapUsed: number; heapMax: number };
		cpu: { recentLoad?: number | null; processors: number };
		http: { requests: number; errors: number } | null;
		threads: { live: number };
	};
}

function ServerCard() {
	const server = useQuery({
		queryKey: ["server-glance"],
		queryFn: () => api.get<ServerGlance>("/admin/server?hours=1"),
		refetchInterval: 30_000,
	});
	const mb = (bytes: number) => `${Math.round(bytes / 1048576).toLocaleString()} MB`;
	const uptime = (seconds: number) => {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		return days ? `${days}d ${hours}h` : `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
	};
	return (
		<Card
			title="Server"
			action={
				<ButtonLink to="/server" size="small">
					Details
				</ButtonLink>
			}
		>
			<CardBody query={server} height={220}>
				{({ snapshot }) => (
					<Stack spacing={1.25}>
						<GlanceRow label="Up" value={uptime(snapshot.jvm.uptimeSeconds)} />
						<GlanceRow label="Heap" value={`${mb(snapshot.memory.heapUsed)} of ${mb(snapshot.memory.heapMax)}`} />
						<GlanceRow
							label="CPU"
							value={snapshot.cpu.recentLoad == null ? "—" : `${Math.round(snapshot.cpu.recentLoad * 100)}% of ${snapshot.cpu.processors}`}
						/>
						<GlanceRow
							label="Requests"
							value={snapshot.http ? `${snapshot.http.requests.toLocaleString()} (${snapshot.http.errors.toLocaleString()} errors)` : "—"}
						/>
						<GlanceRow label="Threads" value={snapshot.threads.live.toLocaleString()} />
					</Stack>
				)}
			</CardBody>
		</Card>
	);
}

function GlanceRow({ label, value }: { label: string; value: string }) {
	return (
		<Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
			<Typography variant="body2" color="text.secondary">
				{label}
			</Typography>
			<Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
				{value}
			</Typography>
		</Stack>
	);
}

function AttentionRow({ count, label }: { count: number; label: string }) {
	return (
		<Stack direction="row" spacing={1.5} sx={{ alignItems: "baseline" }}>
			<Typography
				sx={{ fontWeight: 700, minWidth: 28, fontVariantNumeric: "tabular-nums" }}
				color={count > 0 ? "warning.main" : "text.disabled"}
			>
				{count}
			</Typography>
			<Typography variant="body2" color={count > 0 ? "text.primary" : "text.secondary"}>
				{label}
			</Typography>
		</Stack>
	);
}

function TopPostsCard({ query, sx }: { query: UseQueryResult<TopPosts>; sx?: object }) {
	const theme = useTheme();
	return (
		<Card title="Top posts, last 30 days" sx={sx}>
			<CardBody query={query} height={260}>
				{(data) =>
					data.posts.length === 0 ? (
						<Empty>No visits recorded yet.</Empty>
					) : (
						<BarChart
							height={Math.max(180, data.posts.length * 34 + 40)}
							layout="horizontal"
							hideLegend
							borderRadius={4}
							yAxis={[
								{
									scaleType: "band",
									// The rank keeps band labels unique after truncation.
									data: data.posts.map((post, i) => `${i + 1}. ${truncate(post.title, 26)}`),
									width: 200,
								},
							]}
							xAxis={[{ tickNumber: 5, valueFormatter: (value: number) => compact.format(value) }]}
							series={[{ data: data.posts.map((post) => post.views), label: "Views", color: theme.palette.primary.main }]}
						/>
					)
				}
			</CardBody>
		</Card>
	);
}
