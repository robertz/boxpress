# BoxPress

An open-source blogging platform on [BoxLang](https://boxlang.io) and BoxExpress. Readers get fast, server-rendered pages; writers get a React admin with a visual and Markdown editor; admins get the site's traffic and the running server's health in the same place.

- **Writing:** a visual editor or plain Markdown, with a live preview. Paste or drop images to upload them. Tags, cover images, excerpts and custom addresses. Scheduled posts go live on their own at their time.
- **History:** every save is kept (the latest 30 per post), plus the editor's unsaved work, sent every minute, so it can be picked up on another device.
- **Media library:** uploads lose their location and camera details on the way in, can be converted to WebP and resized in the browser first, and carry alt text that's filled in when an image is inserted.
- **The site:** home, post, tag, author and search pages; an RSS feed, `sitemap.xml` and `robots.txt`; Open Graph and Twitter cards; light and dark following the reader's system. Post bodies are rendered from Markdown when saved and sanitized, so an author's account can't put script on the site.
- **People:** admins manage everything; authors write and manage their own posts. Password sign-in, and passkeys (WebAuthn). An admin's powers can require a session confirmed with a passkey.
- **Insights:** page views by day, top posts, referrers, searches (and those that found nothing) and broken links, from the site's own access log. No third-party analytics, and no IP addresses are stored.
- **Server:** memory, CPU, garbage collection, threads, open files and disk; requests by route with error counts and timings; the database pool and MySQL's own figures; and hourly records charted over up to 90 days.

## Stack

| Part | What |
|---|---|
| Server | BoxLang 1.18+ with BoxExpress: the JSON API, the public pages (`.bxm` templates) and the built admin, in one process |
| Database | MySQL 8, numbered migrations in `server/migrations`, applied at startup |
| Admin | React 19, MUI, TanStack Router and Query, Tiptap and CodeMirror, built with Vite |

## Running it locally

You need BoxLang 1.18+, Node 20.19+ (or 22), MySQL 8, and CommandBox for the tests.

```sql
CREATE DATABASE boxpress_development CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE boxpress_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```bash
install-bx-module boxlang-express bx-mysql bx-password-encrypt bx-markdown bx-esapi bx-passkeys
```

```bash
cp server/.env.example server/.env   # then set BOXPRESS_DB_PASSWORD
```

```bash
cd web && npm install && npm run build && cd ..
```

```bash
server/start.sh
```

The site is at <http://localhost:8080> and the admin at <http://localhost:8080/admin>. A new site has one account, **admin** with the password **admin** (`server/migrations/002_default_admin.sql`). Sign in and change the password under Account; the server warns at startup until you do. To start with your own account instead, set `BOXPRESS_ADMIN_*` in `.env` before the first start, or add one from `server/`:

```bash
boxlang scripts/users.bxs add <username> <email> --admin
```

For hot reload while working on the admin, run `npm run dev` in `web/` as well and open <http://localhost:5173/admin>; Vite proxies everything else to the server on 8080. The server reads the site's built stylesheet name at startup, so restart it after `npm run build`.

## Production with Docker

`docker-compose.yml` runs the app, MySQL 8.4 and a nightly backup:

```bash
cp .env.example .env   # set SITE_URL, MYSQL_PASSWORD and MYSQL_ROOT_PASSWORD
```

```bash
docker compose up -d --build
```

In production the default **admin** / **admin** account can't sign in until it has a password of its own, since that one is public. Set it on the server, then sign in at `/admin`:

```bash
docker compose exec app boxlang scripts/users.bxs password admin
```

Or set `BOXPRESS_ADMIN_*` in `.env` before the first start to have your own account in its place.

The app listens on `127.0.0.1:8080`. Put a reverse proxy that terminates HTTPS in front of it, for example Caddy:

```
blog.example.com {
	reverse_proxy 127.0.0.1:8080 {
		header_up X-Real-IP {remote_host}
	}
}
```

and set `TRUST_PROXY_HEADER=X-Real-IP` so sign-in rate limits count each visitor rather than the proxy. Only set it when nothing can reach the app except through that proxy.

Uploaded images go in the `uploads` volume, served at `/uploads`, unless an S3-compatible bucket is configured (`S3_*` in `.env`: Cloudflare R2, AWS S3, MinIO or Backblaze B2), in which case they're served from `S3_PUBLIC_BASE_URL`.

### Passkeys

Passkeys belong to the domain in `SITE_URL` (or `PASSKEY_RP_ID`), so changing the domain leaves every one behind. In production an admin's powers need a session that signed in, or confirmed, with a passkey; until they add one under Account, an admin works as an author. `ADMIN_PASSKEY_REQUIRED=false` lifts the requirement. Someone who loses theirs signs in with their password after:

```bash
docker compose exec app boxlang scripts/users.bxs passkeys-clear <username>
```

(or an admin removes them from Admin › Authors).

### Backups

The `backup` service dumps the database every night at 08:00 UTC (`BACKUP_HOUR_UTC`) into `./backups`, keeping 14 days (`BACKUP_KEEP_DAYS`). They're on the same disk as the database, so copy them elsewhere too. Take one now:

```bash
docker compose run --rm backup now
```

Restore one into the running database:

```bash
gunzip -c backups/boxpress-2026-11-13.sql.gz | docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" boxpress'
```

## Tests

```bash
cd server && box install && boxlang run-tests.bxs
```

The specs in `server/tests/specs` build the whole app against the `boxpress_test` schema, which they empty before each one: signing in and CSRF, roles, posts and scheduling, sanitizing, revisions, search, feeds, uploads, settings, accounts and server metrics.

## Layout

| Path | Contents |
|---|---|
| `server/server.bxs` | Entry point: settings, migrations, the first admin, scheduled jobs |
| `server/routes/` | `Api.bx` builds the app; one class per area registers its routes (`register( router, svc )`). `SiteRoutes` and `FeedRoutes` are the public site |
| `server/services/` | `Bootstrap` loads settings and wires the services: `Posts`, `Tags`, `Revisions`, `Users`, `Passkeys`, `Media`, `Markdown`, `Sanitizer`, `SiteSettings`, `Feeds`, `RequestLog`, `Insights`, `ServerMonitor`, `ServerHistory`, `RouteStats` |
| `server/views/site/` | The public pages |
| `server/migrations/` | Numbered SQL, applied in order |
| `server/scripts/users.bxs` | Accounts from the command line, and re-rendering every post |
| `web/src/admin/` | The admin app: one folder per section under `modules/` |
| `web/src/site/` | The public site's stylesheet and code highlighting |

## Licence

MIT. See [LICENSE](LICENSE).
