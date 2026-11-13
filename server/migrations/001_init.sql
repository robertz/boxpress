-- BoxPress schema. Migrator applies the numbered files in this folder in
-- order at startup and records each in schema_version; a change is a new
-- file, never an edit to one that has shipped. Times are UTC.

CREATE TABLE users (
	id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
	username      VARCHAR(50)  NOT NULL,
	email         VARCHAR(320) NOT NULL,
	display_name  VARCHAR(100) NOT NULL DEFAULT '',
	bio           TEXT         NULL,
	avatar_url    VARCHAR(1000) NULL,
	website       VARCHAR(500) NULL,
	role          ENUM('admin', 'author') NOT NULL DEFAULT 'author',
	password_hash VARCHAR(200) NOT NULL DEFAULT '',
	disabled_at   DATETIME     NULL,
	last_login_at DATETIME     NULL,
	created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE KEY users_username ( username ),
	UNIQUE KEY users_email ( email )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- BoxExpress sessions (services/SessionStore.bx); ids are stored hashed.
CREATE TABLE sessions (
	id_hash    CHAR(64)   NOT NULL PRIMARY KEY,
	data       MEDIUMTEXT NOT NULL,
	expires_at DATETIME   NOT NULL,
	KEY sessions_expires ( expires_at )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Passkeys (services/Passkeys.bx): credential_id and public_key (SPKI) are
-- base64url, as the browser hands them over; algorithm is the COSE id.
CREATE TABLE user_passkeys (
	id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
	user_id       BIGINT UNSIGNED NOT NULL,
	credential_id VARCHAR(700) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	public_key    TEXT CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	algorithm     INT NOT NULL,
	sign_count    BIGINT UNSIGNED NOT NULL DEFAULT 0,
	transports    VARCHAR(200) NULL,
	name          VARCHAR(100) NOT NULL,
	created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	last_used_at  DATETIME NULL,
	UNIQUE KEY user_passkeys_credential ( credential_id ),
	KEY user_passkeys_user ( user_id ),
	CONSTRAINT user_passkeys_user FOREIGN KEY ( user_id ) REFERENCES users ( id ) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A post is public when status = 'published' and published_at has passed:
-- a future published_at is a scheduled post, and needs no job to go live.
-- body is the Markdown as written; body_html is it rendered and sanitized,
-- made once on save (services/Posts.bx).
CREATE TABLE posts (
	id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
	author_id       BIGINT UNSIGNED NOT NULL,
	title           VARCHAR(255)  NOT NULL,
	slug            VARCHAR(255)  NOT NULL,
	excerpt         VARCHAR(500)  NOT NULL DEFAULT '',
	body            MEDIUMTEXT    NOT NULL,
	body_html       MEDIUMTEXT    NOT NULL,
	cover_image     VARCHAR(1000) NULL,
	status          ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
	published_at    DATETIME      NULL,
	featured        TINYINT(1)    NOT NULL DEFAULT 0,
	reading_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 1,
	created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	UNIQUE KEY posts_slug ( slug ),
	KEY posts_public ( status, published_at ),
	KEY posts_author ( author_id, status, published_at ),
	FULLTEXT KEY posts_search ( title, excerpt, body ),
	CONSTRAINT posts_author FOREIGN KEY ( author_id ) REFERENCES users ( id )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tags (
	id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
	name VARCHAR(50) NOT NULL,
	slug VARCHAR(60) NOT NULL,
	UNIQUE KEY tags_slug ( slug )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE post_tags (
	post_id  BIGINT UNSIGNED NOT NULL,
	tag_id   BIGINT UNSIGNED NOT NULL,
	position SMALLINT UNSIGNED NOT NULL DEFAULT 0,
	PRIMARY KEY ( post_id, tag_id ),
	KEY post_tags_tag ( tag_id ),
	CONSTRAINT post_tags_post FOREIGN KEY ( post_id ) REFERENCES posts ( id ) ON DELETE CASCADE,
	CONSTRAINT post_tags_tag FOREIGN KEY ( tag_id ) REFERENCES tags ( id ) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- kind 'save': a snapshot each time a post is saved, the latest 30 kept.
-- kind 'autosave': the editor's unsaved work, one per post and user,
-- replaced each time and removed on save; it never changes the post.
CREATE TABLE post_revisions (
	id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
	post_id     BIGINT UNSIGNED NOT NULL,
	user_id     BIGINT UNSIGNED NULL,
	kind        ENUM('save', 'autosave') NOT NULL DEFAULT 'save',
	title       VARCHAR(255)  NOT NULL,
	excerpt     VARCHAR(500)  NOT NULL DEFAULT '',
	cover_image VARCHAR(1000) NULL,
	body        MEDIUMTEXT    NOT NULL,
	tags        VARCHAR(1000) NOT NULL DEFAULT '',
	created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
	KEY post_revisions_post ( post_id, kind, created_at ),
	CONSTRAINT post_revisions_post FOREIGN KEY ( post_id ) REFERENCES posts ( id ) ON DELETE CASCADE,
	CONSTRAINT post_revisions_user FOREIGN KEY ( user_id ) REFERENCES users ( id ) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The media library (services/Media.bx): files in S3-compatible storage or
-- server/uploads, keyed by storage_key.
CREATE TABLE media (
	id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
	owner_id      BIGINT UNSIGNED NOT NULL,
	storage_key   VARCHAR(512)  NOT NULL,
	url           VARCHAR(1000) NOT NULL,
	content_type  VARCHAR(50)   NOT NULL,
	width         INT UNSIGNED  NOT NULL,
	height        INT UNSIGNED  NOT NULL,
	bytes         BIGINT UNSIGNED NOT NULL,
	alt_text      VARCHAR(500)  NOT NULL DEFAULT '',
	original_name VARCHAR(255)  NOT NULL DEFAULT '',
	created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE KEY media_key ( storage_key ),
	KEY media_owner ( owner_id ),
	CONSTRAINT media_owner FOREIGN KEY ( owner_id ) REFERENCES users ( id )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Site settings an admin edits in Admin > Settings (services/SiteSettings.bx).
CREATE TABLE site_settings (
	name       VARCHAR(100) NOT NULL PRIMARY KEY,
	value      TEXT         NOT NULL,
	updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Readers' views of each post by day, bots left out (services/Insights.bx).
CREATE TABLE post_views_daily (
	post_id   BIGINT UNSIGNED NOT NULL,
	view_date DATE NOT NULL,
	views     INT UNSIGNED NOT NULL DEFAULT 0,
	PRIMARY KEY ( post_id, view_date ),
	KEY post_views_daily_date ( view_date ),
	CONSTRAINT post_views_daily_post FOREIGN KEY ( post_id ) REFERENCES posts ( id ) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Every site search with its result count, for the Insights page.
CREATE TABLE search_log (
	id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
	query        VARCHAR(255) NOT NULL,
	result_count INT UNSIGNED NOT NULL DEFAULT 0,
	searched_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	KEY search_log_time ( searched_at )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- An access log (services/RequestLog.bx), written in the background and kept
-- REQUEST_LOG_DAYS. No IP addresses are stored.
CREATE TABLE request_log (
	id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
	requested_at  DATETIME(3)   NOT NULL,
	method        VARCHAR(10)   NOT NULL,
	path          VARCHAR(2048) NOT NULL,
	query_string  TEXT          NOT NULL,
	status_code   SMALLINT UNSIGNED NULL,
	duration_ms   INT UNSIGNED  NOT NULL,
	referrer      TEXT          NOT NULL,
	referrer_host VARCHAR(255)  NOT NULL DEFAULT '',
	user_agent    TEXT          NOT NULL,
	is_bot        TINYINT(1)    NOT NULL DEFAULT 0,
	KEY request_log_time ( requested_at ),
	KEY request_log_path ( path(191) )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per completed day and kind: 'pageviews' (name ''), 'referrer'
-- (by host, '' for direct) and '404' (by path). Never deleted, so they
-- outlive request_log's retention. A day is done once its pageviews row exists.
CREATE TABLE request_log_daily (
	log_date DATE         NOT NULL,
	kind     VARCHAR(16)  NOT NULL,
	name     VARCHAR(500) NOT NULL DEFAULT '',
	hits     INT UNSIGNED NOT NULL,
	PRIMARY KEY ( log_date, kind, name )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- An hourly record of the running server (services/ServerHistory.bx), kept
-- 90 days, for the admin's Server charts. *_hour values are since the
-- previous row, NULL for the first row after a restart.
CREATE TABLE server_metrics (
	recorded_at         DATETIME NOT NULL PRIMARY KEY,
	uptime_seconds      INT NOT NULL,
	heap_used           BIGINT NOT NULL,
	heap_max            BIGINT NOT NULL,
	old_gen_after_gc    BIGINT NULL,
	direct_used         BIGINT NULL,
	open_files          INT NULL,
	memory_free         BIGINT NULL,
	cpu_load_hour       DOUBLE NULL,
	full_gcs_hour       INT NULL,
	full_gc_causes_hour TEXT NULL,
	gc_ms_hour          INT NULL,
	http_requests_hour  INT NULL,
	http_errors_hour    INT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
