#!/usr/bin/env bash
# Nightly dumps of the database, run by docker-compose.yml's backup service
# (the mysql image, which has mysqldump). Each night at BACKUP_HOUR_UTC a
# gzipped dump goes into /backups (./backups next to docker-compose.yml),
# kept BACKUP_KEEP_DAYS days. They're on the same disk as the database: copy
# them somewhere else too (rsync, restic, your host's snapshots).
#
# `backup.sh now` takes one and exits.
set -euo pipefail

hour=${BACKUP_HOUR_UTC:-8}
keep_days=${BACKUP_KEEP_DAYS:-14}
dir=/backups

log() {
	echo "[backup] $(date -u +%FT%TZ) $*"
}

backup() {
	local file="$dir/${DB_NAME}-$(date -u +%F).sql.gz"
	# --single-transaction: a consistent copy without locking the app out (every table is InnoDB)
	MYSQL_PWD="$DB_PASSWORD" mysqldump \
		--host="$DB_HOST" --user="$DB_USER" \
		--single-transaction --quick --no-tablespaces --set-gtid-purged=OFF \
		--default-character-set=utf8mb4 \
		"$DB_NAME" | gzip -6 >"$file.partial"
	mv "$file.partial" "$file"
	log "dumped $DB_NAME: $(du -h "$file" | cut -f1) in $file"
	find "$dir" -name "${DB_NAME}-*.sql.gz" -mtime +"$keep_days" -print -delete | sed 's/^/[backup] removed /'
}

if [[ ${1:-} == now ]]; then
	backup
	exit 0
fi

log "nightly at $(printf %02d "$hour"):00 UTC, kept $keep_days days"
while true; do
	now=$(date -u +%s)
	next=$(date -u -d "today $hour:00" +%s)
	if ((next <= now)); then
		next=$(date -u -d "tomorrow $hour:00" +%s)
	fi
	sleep $((next - now))
	backup || log "FAILED: the dump didn't finish"
done
