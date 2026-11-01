CREATE TABLE IF NOT EXISTS members_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL UNIQUE CHECK (length(trim(nickname)) BETWEEN 2 AND 20),
    email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(email)) BETWEEN 3 AND 254),
    gender TEXT NOT NULL CHECK (gender IN ('female', 'male', 'prefer-not-to-say')),
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_login_at TEXT
);

INSERT INTO members_v2 (id, nickname, email, gender, password_hash, password_salt, created_at, updated_at, last_login_at)
SELECT id, nickname, email, gender, password_hash, password_salt, created_at, updated_at, last_login_at FROM members;

DROP TABLE members;
ALTER TABLE members_v2 RENAME TO members;

CREATE INDEX IF NOT EXISTS idx_members_created_a
    ON members (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_member_id
    ON auth_sessions (member_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_a
    ON auth_sessions (expires_at);