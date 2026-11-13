import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { ConfirmDialog } from "../../shared/ConfirmDialog";
import { errorMessage } from "../../app/api";
import { boot, isAdmin } from "../../app/boot";
import { AdminOnly } from "../../shared/AdminOnly";
import { Page, PageHeader } from "../../shared/Page";
import { ButtonLink } from "../../shared/links";
import { authorsApi, type Author, type AuthorInput } from "./api";

function AuthorForm({ author }: { author: Author | null }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [form, setForm] = useState<AuthorInput>({
		username: author?.username ?? "",
		displayName: author?.displayName ?? "",
		email: author?.email ?? "",
		role: author?.role ?? "author",
		about: author?.about ?? "",
		avatarUrl: author?.avatarUrl ?? "",
		website: author?.website ?? "",
		password: "",
	});
	const [confirming, setConfirming] = useState<"" | "delete" | "passkeys">("");
	const isSelf = author?.id === String(boot.user.id);
	const [flash, setFlash] = useState<{ severity: "success" | "error"; text: string } | null>(null);

	function update(patch: Partial<AuthorInput>) {
		setForm((current) => ({ ...current, ...patch }));
	}

	const save = useMutation({
		mutationFn: (input: AuthorInput) => (author ? authorsApi.update(author.id, input) : authorsApi.create(input)),
		onSuccess: (saved) => {
			queryClient.invalidateQueries({ queryKey: ["authors"] });
			queryClient.setQueryData(["author", saved.id], saved);
			if (!author) {
				navigate({ to: "/authors/$authorId/edit", params: { authorId: saved.id }, replace: true });
				return;
			}
			update({ password: "" });
			setFlash({ severity: "success", text: "Author saved." });
		},
		onError: (err) => setFlash({ severity: "error", text: errorMessage(err, "Couldn't save the author.") }),
	});

	const account = useMutation({
		mutationFn: async (action: "disable" | "enable" | "passkeys" | "delete") => {
			if (!author) return;
			if (action === "delete") return authorsApi.remove(author.id);
			if (action === "passkeys") return authorsApi.clearPasskeys(author.id);
			return authorsApi.setDisabled(author.id, action === "disable");
		},
		onSuccess: (_result, action) => {
			setConfirming("");
			queryClient.invalidateQueries({ queryKey: ["authors"] });
			queryClient.invalidateQueries({ queryKey: ["author", author?.id] });
			if (action === "delete") {
				navigate({ to: "/authors" });
				return;
			}
			setFlash({
				severity: "success",
				text: action === "passkeys" ? "Their passkeys are removed; they sign in with their password and can add new ones." : action === "disable" ? "The account is disabled." : "The account is enabled.",
			});
		},
		onError: (err) => {
			setConfirming("");
			setFlash({ severity: "error", text: errorMessage(err, "Couldn't change the account.") });
		},
	});

	return (
		<Page>
			<PageHeader
				eyebrow="Admin"
				title={author ? "Edit author" : "New author"}
				subtitle={author ? author.email : "They can sign in as soon as the account is created."}
			/>

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
					<TextField
						label="Username"
						required
						value={form.username}
						disabled={Boolean(author)}
						placeholder="jane"
						helperText={author ? `Their page is /author/${author.username}.` : "For signing in and their page's address. Letters, digits, . _ -"}
						slotProps={{ htmlInput: { maxLength: 50, autoComplete: "off" } }}
						onChange={(e) => update({ username: e.target.value })}
					/>
					<TextField
						label="Display name"
						value={form.displayName}
						placeholder="Jane Smith"
						slotProps={{ htmlInput: { maxLength: 100 } }}
						onChange={(e) => update({ displayName: e.target.value })}
					/>
					<TextField
						label="Email"
						type="email"
						required
						value={form.email}
						placeholder="jane@example.com"
						onChange={(e) => update({ email: e.target.value })}
					/>
					<TextField
						select
						label="Role"
						value={form.role}
						disabled={!isAdmin || isSelf}
						helperText={isSelf ? "You can't change your own role." : "An author writes and manages their own posts; an admin manages everything."}
						onChange={(e) => update({ role: e.target.value })}
					>
						<MenuItem value="author">Author</MenuItem>
						<MenuItem value="admin">Admin</MenuItem>
					</TextField>
					<TextField
						label="Website"
						type="url"
						value={form.website}
						placeholder="https://example.com"
						onChange={(e) => update({ website: e.target.value })}
					/>
					<TextField
						label="Avatar address"
						value={form.avatarUrl}
						placeholder="https://… or /uploads/…"
						helperText="Initials are shown without one."
						onChange={(e) => update({ avatarUrl: e.target.value })}
					/>
					<TextField
						label="Bio"
						multiline
						minRows={3}
						value={form.about}
						placeholder="A short bio shown on posts…"
						helperText={`${form.about.length} / 1000 characters`}
						slotProps={{ htmlInput: { maxLength: 1000 } }}
						sx={{ gridColumn: "1 / -1" }}
						onChange={(e) => update({ about: e.target.value })}
					/>
					<TextField
						label="Password"
						type="password"
						required={!author}
						value={form.password}
						helperText={author ? "Leave blank to keep the current password." : "At least 8 characters."}
						slotProps={{ htmlInput: { autoComplete: "new-password" } }}
						onChange={(e) => update({ password: e.target.value })}
					/>
				</Box>

				<Stack direction="row" spacing={1} sx={{ mt: 3 }}>
					<Button type="submit" variant="contained" startIcon={<SaveOutlined />} loading={save.isPending}>
						{author ? "Save changes" : "Create author"}
					</Button>
					{isAdmin && (
						<ButtonLink to="/authors" color="inherit">
							Cancel
						</ButtonLink>
					)}
				</Stack>
			</Paper>

			{author && isAdmin && !isSelf && (
				<Paper sx={{ p: 3, mt: 2, maxWidth: 880 }}>
					<Typography variant="h3" component="h2" sx={{ mb: 1 }}>
						Account
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
						{author.disabled ? "Disabled: they can't sign in, and their posts stay up." : "Active."} {author.passkeys} {author.passkeys === 1 ? "passkey" : "passkeys"}.
						{author.lastLoginAt ? ` Last signed in ${new Date(author.lastLoginAt).toLocaleString()}.` : " Never signed in."}
					</Typography>
					<Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
						<Button variant="outlined" disabled={account.isPending} onClick={() => account.mutate(author.disabled ? "enable" : "disable")}>
							{author.disabled ? "Enable account" : "Disable account"}
						</Button>
						{author.passkeys > 0 && (
							<Button variant="outlined" disabled={account.isPending} onClick={() => setConfirming("passkeys")}>
								Remove their passkeys
							</Button>
						)}
						<Divider flexItem orientation="vertical" />
						<Button color="error" variant="outlined" disabled={account.isPending || author.postCount > 0} onClick={() => setConfirming("delete")}>
							Delete account
						</Button>
					</Stack>
					{author.postCount > 0 && (
						<Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
							An account with posts can't be deleted; disable it instead.
						</Typography>
					)}
				</Paper>
			)}

			<ConfirmDialog
				open={confirming === "delete"}
				title="Delete this account?"
				confirmLabel="Delete"
				busy={account.isPending}
				onConfirm={() => account.mutate("delete")}
				onClose={() => setConfirming("")}
			>
				{author?.displayName} won't be able to sign in again. This can't be undone.
			</ConfirmDialog>
			<ConfirmDialog
				open={confirming === "passkeys"}
				title="Remove their passkeys?"
				confirmLabel="Remove"
				busy={account.isPending}
				onConfirm={() => account.mutate("passkeys")}
				onClose={() => setConfirming("")}
			>
				For someone who lost theirs: they sign in with their password, then add a new passkey under Account.
			</ConfirmDialog>
		</Page>
	);
}

export function NewAuthorPage() {
	return (
		<AdminOnly>
			<AuthorForm key="new" author={null} />
		</AdminOnly>
	);
}

const editRoute = getRouteApi("/authors/$authorId/edit");

// Authors change their own profile under Account; this page is an admin's.
export function EditAuthorPage() {
	return (
		<AdminOnly>
			<EditAuthor />
		</AdminOnly>
	);
}

function EditAuthor() {
	const { authorId } = editRoute.useParams();
	const author = useQuery({ queryKey: ["author", authorId], queryFn: () => authorsApi.get(authorId) });

	if (author.isPending) {
		return (
			<Page>
				<Skeleton variant="rounded" height={360} />
			</Page>
		);
	}
	if (author.isError) {
		return (
			<Page>
				<Alert severity="error">{errorMessage(author.error, "Couldn't load this author.")}</Alert>
			</Page>
		);
	}
	return <AuthorForm key={author.data.id} author={author.data} />;
}
