import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import { api, errorMessage } from "../../app/api";
import { AdminOnly } from "../../shared/AdminOnly";
import { Page, PageHeader } from "../../shared/Page";

/** server/services/SiteSettings.bx */
interface SiteSettings {
	title: string;
	tagline: string;
	description: string;
	postsPerPage: number;
	footerText: string;
	socialImage: string;
	accentColor: string;
	language: string;
}

function SettingsForm({ initial }: { initial: SiteSettings }) {
	const queryClient = useQueryClient();
	const [form, setForm] = useState(initial);
	const [flash, setFlash] = useState<{ severity: "success" | "error"; text: string } | null>(null);

	const save = useMutation({
		mutationFn: (next: SiteSettings) => api.put<SiteSettings>("/admin/settings", next),
		onSuccess: (saved) => {
			queryClient.setQueryData(["settings"], saved);
			setForm(saved);
			setFlash({ severity: "success", text: "Settings saved. The site shows them now." });
		},
		onError: (err) => setFlash({ severity: "error", text: errorMessage(err, "Couldn't save the settings.") }),
	});

	const rerender = useMutation({
		mutationFn: () => api.post<{ rendered: number }>("/admin/rerender"),
		onSuccess: (r) => setFlash({ severity: "success", text: `Rendered ${r.rendered} posts again.` }),
		onError: (err) => setFlash({ severity: "error", text: errorMessage(err, "Couldn't render the posts.") }),
	});

	function update(patch: Partial<SiteSettings>) {
		setForm((current) => ({ ...current, ...patch }));
	}

	return (
		<>
			{flash && (
				<Alert severity={flash.severity} sx={{ mb: 2 }} onClose={() => setFlash(null)}>
					{flash.text}
				</Alert>
			)}
			<Paper
				component="form"
				sx={{ p: 3, maxWidth: 880 }}
				onSubmit={(e: FormEvent) => {
					e.preventDefault();
					setFlash(null);
					save.mutate(form);
				}}
			>
				<Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" } }}>
					<TextField label="Site title" required value={form.title} slotProps={{ htmlInput: { maxLength: 100 } }} onChange={(e) => update({ title: e.target.value })} />
					<TextField
						label="Tagline"
						value={form.tagline}
						helperText="Shown at the top of the home page."
						slotProps={{ htmlInput: { maxLength: 200 } }}
						onChange={(e) => update({ tagline: e.target.value })}
					/>
					<TextField
						label="Description"
						multiline
						minRows={2}
						value={form.description}
						helperText="What search engines, feeds and sharing cards say about the site."
						slotProps={{ htmlInput: { maxLength: 500 } }}
						sx={{ gridColumn: "1 / -1" }}
						onChange={(e) => update({ description: e.target.value })}
					/>
					<TextField
						label="Posts per page"
						type="number"
						value={form.postsPerPage}
						slotProps={{ htmlInput: { min: 1, max: 50 } }}
						onChange={(e) => update({ postsPerPage: Number(e.target.value) })}
					/>
					<TextField
						label="Language"
						value={form.language}
						helperText="A language tag, such as en or pt-BR."
						onChange={(e) => update({ language: e.target.value })}
					/>
					<Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
						<TextField
							label="Accent colour"
							value={form.accentColor}
							helperText="Links and buttons on the site."
							sx={{ flex: 1 }}
							onChange={(e) => update({ accentColor: e.target.value })}
						/>
						<Box
							component="input"
							type="color"
							aria-label="Pick the accent colour"
							value={/^#[0-9a-f]{6}$/i.test(form.accentColor) ? form.accentColor : "#4f46e5"}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({ accentColor: e.target.value })}
							sx={{ width: 48, height: 40, p: 0, border: 0, bgcolor: "transparent", cursor: "pointer" }}
						/>
					</Stack>
					<TextField
						label="Sharing image"
						value={form.socialImage}
						placeholder="https://… or /uploads/…"
						helperText="Shown when a page without a cover is shared."
						onChange={(e) => update({ socialImage: e.target.value })}
					/>
					<TextField
						label="Footer"
						value={form.footerText}
						placeholder={`© ${new Date().getFullYear()} ${form.title}`}
						slotProps={{ htmlInput: { maxLength: 500 } }}
						sx={{ gridColumn: "1 / -1" }}
						onChange={(e) => update({ footerText: e.target.value })}
					/>
				</Box>
				<Button type="submit" variant="contained" startIcon={<SaveOutlined />} loading={save.isPending} sx={{ mt: 3 }}>
					Save settings
				</Button>
			</Paper>

			<Paper sx={{ p: 3, mt: 2, maxWidth: 880 }}>
				<Typography variant="h3" component="h2" sx={{ mb: 1 }}>
					Render every post again
				</Typography>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
					Each post's page is made from its Markdown when it's saved. After upgrading BoxPress, this brings older posts up to date.
				</Typography>
				<Button variant="outlined" loading={rerender.isPending} onClick={() => rerender.mutate()}>
					Render posts
				</Button>
			</Paper>
		</>
	);
}

function Settings() {
	const settings = useQuery({ queryKey: ["settings"], queryFn: () => api.get<SiteSettings>("/admin/settings") });
	return (
		<Page>
			<PageHeader eyebrow="Admin" title="Settings" subtitle="How the site presents itself." />
			{settings.isPending && <Skeleton variant="rounded" height={420} />}
			{settings.isError && <Alert severity="error">{errorMessage(settings.error, "Couldn't load settings.")}</Alert>}
			{settings.data && <SettingsForm initial={settings.data} />}
		</Page>
	);
}

export function SettingsPage() {
	return (
		<AdminOnly>
			<Settings />
		</AdminOnly>
	);
}
