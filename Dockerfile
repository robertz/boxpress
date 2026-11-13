# ── Web app: the admin and the public site's CSS/JS ──────────────────────
# Vite 8 needs Node 20.19+ or 22.
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────
# The bare BoxLang CLI: BoxExpress runs its own HTTP server. Pinned so a
# rebuild never changes BoxLang underneath; bump it deliberately.
FROM ortussolutions/boxlang:cli-1.19.0 AS app

ENV APP_DIR=/app
WORKDIR $APP_DIR

# install-bx-module finds its helper scripts through this. ARG, not ENV: any
# BOXLANG_* variable present at runtime makes BoxLang drop config file blocks.
ARG BOXLANG_INSTALL_HOME=/usr/local/boxlang

# The base image ships a sample site in /app.
RUN rm -rf /app/* /app/.[!.]*

# jsoup is a plain jar in server/lib, not a module.
ARG BOXLANG_MODULES=boxlang-express,bx-mysql,bx-password-encrypt,bx-markdown,bx-esapi,bx-passkeys@0.3.1
RUN install-bx-module "$BOXLANG_MODULES" --local

COPY server/server.bxs server/.boxlang.json ./
COPY server/services/ services/
COPY server/routes/ routes/
COPY server/views/ views/
COPY server/public/ public/
COPY server/migrations/ migrations/
COPY server/scripts/ scripts/
COPY server/lib/ lib/
COPY --from=web /web/dist web/

# An ordinary user, not root. BoxLang keeps its home (compiled classes, caches)
# in ~/.boxlang, so the image's copy moves with it; /app/uploads is where
# uploads go when no S3 bucket is configured (a volume in docker-compose.yml).
RUN useradd --system --create-home --home-dir /home/app --shell /usr/sbin/nologin app \
	&& cp -a /root/.boxlang /home/app/.boxlang \
	&& mkdir -p /app/uploads \
	&& chown -R app:app /home/app /app
USER app
ENV HOME=/home/app

ENV WEB_ROOT=/app/web
ENV UPLOADS_DIR=/app/uploads
ENV PORT=8080
EXPOSE 8080

# The heap is a share of the container's memory limit; running out exits, so
# Docker restarts the container.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:InitialRAMPercentage=25 -XX:+ExitOnOutOfMemoryError"
# The launcher adds -XX:TieredStopAtLevel=1 for scripts; a server wants full C2, and the last flag wins.
ENV BOXLANG_OPTS="-XX:TieredStopAtLevel=4"

CMD ["boxlang", "server.bxs"]

# ── Tests ────────────────────────────────────────────────────────────────
# The specs in the image above, against BOXPRESS_DB_* (they always use the
# boxpress_test schema): docker build --target test -t boxpress-test . &&
# docker run --rm --network <mysql network> -e BOXPRESS_DB_HOST=... boxpress-test
FROM ortussolutions/commandbox:jdk21-alpine-3.24.0 AS testbox
WORKDIR /deps
COPY server/box.json ./
RUN box install && rm -rf testbox/tests testbox/bx/tests

FROM app AS test
COPY --from=testbox --chown=app:app /deps/testbox testbox/
COPY --chown=app:app server/tests/ tests/
COPY --chown=app:app server/run-tests.bxs ./
CMD ["boxlang", "run-tests.bxs"]
