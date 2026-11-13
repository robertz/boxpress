import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import KeyOutlined from "@mui/icons-material/KeyOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import { api, errorMessage, isPasskeyRequired } from "../../app/api";
import { boot, setCsrfToken, setMe, type Me } from "../../app/boot";
import { createPasskey, passkeysSupported, type CreationOptions } from "../../app/passkeys";
import { confirmWithPasskey } from "../../app/session";
import { ConfirmDialog } from "../../shared/ConfirmDialog";
import { Page, PageHeader } from "../../shared/Page";
import { formatDateTime } from "../../shared/dates";

interface Passkey {
	id: number;
	name: string;
	createdAt: string;
	lastUsedAt: string | null;
}

type Flash = { severity: "success" | "error"; text: string } | null;

function Profile() {
	const [form, setForm] = useState({
		displayName: boot.user.displayName === boot.user.username ? "" : boot.user.displayName,
		email: boot.user.email,
		bio: boot.user.bio,
		website: boot.user.website,
		avatarUrl: boot.user.avatarUrl,
	});
	const [flash, setFlash] = useState<Flash>(null);
	const save = useMutation({
		mutationFn: () => api.patch<Me>("/account", form),
		onSuccess: (me) => {
			setMe(me);
			setFlash({ severity: "success", text: "Profile saved." });
		},
		onError: (err) => setFlash({ severity: "error", text: errorMessage(err, "Couldn't save your profile.") }),
	});
	const update = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

	return (
		<Paper
			component="form"
			sx={{ p: 3 }}
			onSubmit={(e: FormEvent) => {
				e.preventDefault();
				setFlash(null);
				save.mutate();
			}}
		>
			<Typography variant="h3" component="h2" sx={{ mb: 0.5 }}>
				Profile
			</Typography>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
				Shown with your posts and on <a href={`/author/${encodeURIComponent(boot.user.username)}`}>your author page</a>.
			</Typography>
			{flash && (
				<Alert severity={flash.severity} sx={{ mb: 2 }} onClose={() => setFlash(null)}>
					{flash.text}
				</Alert>
			)}
			<Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" } }}>
				<TextField label="Display name" value={form.displayName} placeholder={boot.user.username} onChange={(e) => update({ displayName: e.target.value })} />
				<TextField label="Email" type="email" required value={form.email} onChange={(e) => update({ email: e.target.value })} />
				<TextField label="Website" type="url" value={form.website} placeholder="https://example.com" onChange={(e) => update({ website: e.target.value })} />
				<TextField label="Avatar address" value={form.avatarUrl} placeholder="https://… or /uploads/…" onChange={(e) => update({ avatarUrl: e.target.value })} />
				<TextField
					label="Bio"
					multiline
					minRows={3}
					value={form.bio}
					helperText={`${form.bio.length} / 1000 characters`}
					slotProps={{ htmlInput: { maxLength: 1000 } }}
					sx={{ gridColumn: "1 / -1" }}
					onChange={(e) => update({ bio: e.target.value })}
				/>
			</Box>
			<Button type="submit" variant="contained" startIcon={<SaveOutlined />} loading={save.isPending} sx={{ mt: 3 }}>
				Save profile
			</Button>
		</Paper>
	);
}

function Password() {
	const [currentPassword, setCurrent] = useState("");
	const [newPassword, setNew] = useState("");
	const [flash, setFlash] = useState<Flash>(null);
	const save = useMutation({
		mutationFn: () => api.post<{ csrfToken: string }>("/auth/password", { currentPassword, newPassword }),
		onSuccess: (r) => {
			setCsrfToken(r.csrfToken);
			setCurrent("");
			setNew("");
			setFlash({ severity: "success", text: "Password changed. Your other sessions are signed out." });
		},
		onError: (err) => setFlash({ severity: "error", text: errorMessage(err, "Couldn't change your password.") }),
	});
	return (
		<Paper
			component="form"
			sx={{ p: 3 }}
			onSubmit={(e: FormEvent) => {
				e.preventDefault();
				setFlash(null);
				save.mutate();
			}}
		>
			<Typography variant="h3" component="h2" sx={{ mb: 2.5 }}>
				Password
			</Typography>
			{flash && (
				<Alert severity={flash.severity} sx={{ mb: 2 }} onClose={() => setFlash(null)}>
					{flash.text}
				</Alert>
			)}
			<Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
				<TextField
					label="Current password"
					type="password"
					required
					autoComplete="current-password"
					value={currentPassword}
					onChange={(e) => setCurrent(e.target.value)}
					sx={{ flex: 1 }}
				/>
				<TextField
					label="New password"
					type="password"
					required
					autoComplete="new-password"
					helperText="At least 8 characters."
					value={newPassword}
					onChange={(e) => setNew(e.target.value)}
					sx={{ flex: 1 }}
				/>
			</Stack>
			<Button type="submit" variant="contained" loading={save.isPending} sx={{ mt: 3 }}>
				Change password
			</Button>
		</Paper>
	);
}

function Passkeys() {
	const queryClient = useQueryClient();
	const passkeys = useQuery({ queryKey: ["passkeys"], queryFn: () => api.get<Passkey[]>("/account/passkeys") });
	const [flash, setFlash] = useState<Flash>(null);
	const [removing, setRemoving] = useState<Passkey | null>(null);

	// Once the account has a passkey, adding or removing one takes a session confirmed with one.
	async function withConfirmation<T>(action: () => Promise<T>): Promise<T | null> {
		try {
			return await action();
		} catch (err) {
			if (!isPasskeyRequired(err)) throw err;
			if (!(await confirmWithPasskey())) return null;
			return action();
		}
	}

	async function refreshMe() {
		setMe(await api.get<Me>("/account"));
		queryClient.invalidateQueries({ queryKey: ["passkeys"] });
	}

	const add = useMutation({
		mutationFn: async () => {
			const options = await withConfirmation(() => api.post<CreationOptions>("/account/passkeys/options"));
			if (!options) return false;
			const registration = await createPasskey(options);
			if (!registration) return false;
			await api.post("/account/passkeys", registration);
			return true;
		},
		onSuccess: async (added) => {
			if (!added) return;
			await refreshMe();
			setFlash({ severity: "success", text: "Passkey added. You can sign in with it now." });
		},
		onError: (err) => setFlash({ severity: "error", text: errorMessage(err, "Couldn't add a passkey.") }),
	});

	const remove = useMutation({
		mutationFn: (passkey: Passkey) => withConfirmation(() => api.delete(`/account/passkeys/${passkey.id}`)),
		onSuccess: async () => {
			setRemoving(null);
			await refreshMe();
		},
		onError: (err) => {
			setRemoving(null);
			setFlash({ severity: "error", text: errorMessage(err, "Couldn't remove the passkey.") });
		},
	});

	return (
		<Paper sx={{ p: 3 }}>
			<Typography variant="h3" component="h2" sx={{ mb: 0.5 }}>
				Passkeys
			</Typography>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
				Sign in with your device's fingerprint, face or PIN instead of a password.
				{boot.user.role === "admin" && boot.passkeysForAdmins && " This site asks admins to confirm with a passkey before using admin pages."}
			</Typography>
			{flash && (
				<Alert severity={flash.severity} sx={{ mb: 2 }} onClose={() => setFlash(null)}>
					{flash.text}
				</Alert>
			)}
			{passkeys.isError && <Alert severity="error">{errorMessage(passkeys.error, "Couldn't load your passkeys.")}</Alert>}
			{passkeys.data && passkeys.data.length > 0 && (
				<List disablePadding sx={{ mb: 2 }}>
					{passkeys.data.map((passkey) => (
						<ListItem
							key={passkey.id}
							divider
							secondaryAction={
								<IconButton edge="end" aria-label={`Remove ${passkey.name}`} onClick={() => setRemoving(passkey)}>
									<DeleteOutline />
								</IconButton>
							}
						>
							<ListItemText
								primary={passkey.name}
								secondary={`Added ${formatDateTime(passkey.createdAt)}${passkey.lastUsedAt ? ` · last used ${formatDateTime(passkey.lastUsedAt)}` : ""}`}
							/>
						</ListItem>
					))}
				</List>
			)}
			{passkeysSupported() ? (
				<Button variant="outlined" startIcon={<KeyOutlined />} loading={add.isPending} onClick={() => add.mutate()}>
					Add a passkey
				</Button>
			) : (
				<Alert severity="info">This browser can't make passkeys.</Alert>
			)}
			<ConfirmDialog
				open={Boolean(removing)}
				title="Remove this passkey?"
				confirmLabel="Remove"
				busy={remove.isPending}
				onConfirm={() => removing && remove.mutate(removing)}
				onClose={() => setRemoving(null)}
			>
				You won't be able to sign in with “{removing?.name}” any more.
			</ConfirmDialog>
		</Paper>
	);
}

export function AccountPage() {
	return (
		<Page>
			<PageHeader title="Account" subtitle={`Signed in as ${boot.user.username} (${boot.user.role}).`} />
			<Stack spacing={2} sx={{ maxWidth: 880 }}>
				<Profile />
				<Passkeys />
				<Password />
			</Stack>
		</Page>
	);
}
