import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import KeyOutlined from "@mui/icons-material/KeyOutlined";
import { errorMessage } from "./api";
import { boot } from "./boot";
import { passkeysSupported } from "./passkeys";
import { signIn, signInWithPasskey } from "./session";

export function LoginPage({ onSignedIn }: { onSignedIn: () => void }) {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	async function submit(e: FormEvent) {
		e.preventDefault();
		setBusy(true);
		setError("");
		try {
			await signIn(username, password);
			onSignedIn();
		} catch (err) {
			setError(errorMessage(err, "Couldn't sign in."));
			setBusy(false);
		}
	}

	async function withPasskey() {
		setBusy(true);
		setError("");
		try {
			if (await signInWithPasskey()) {
				onSignedIn();
				return;
			}
		} catch (err) {
			setError(errorMessage(err, "Couldn't sign in with a passkey."));
		}
		setBusy(false);
	}

	return (
		<Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "background.default", p: 2 }}>
			<Paper component="form" onSubmit={submit} sx={{ p: 4, width: "100%", maxWidth: 400 }}>
				<Typography variant="overline" color="text.secondary">
					{boot.siteName}
				</Typography>
				<Typography variant="h1" sx={{ mb: 3 }}>
					Sign in
				</Typography>
				<Stack spacing={2}>
					{error && <Alert severity="error">{error}</Alert>}
					<TextField
						label="Username or email"
						autoComplete="username webauthn"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						autoFocus
						required
					/>
					<TextField
						label="Password"
						type="password"
						autoComplete="current-password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>
					<Button type="submit" variant="contained" size="large" disabled={busy}>
						Sign in
					</Button>
					{passkeysSupported() && (
						<>
							<Divider>or</Divider>
							<Button variant="outlined" size="large" startIcon={<KeyOutlined />} onClick={withPasskey} disabled={busy}>
								Sign in with a passkey
							</Button>
						</>
					)}
				</Stack>
				<Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
					<a href="/">Back to the site</a>
				</Typography>
			</Paper>
		</Box>
	);
}
