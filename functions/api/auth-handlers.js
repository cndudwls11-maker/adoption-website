const SESSION_COOKIE = 'pogeun_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const HASH_PREFIX = 'pbkdf2-sha256-pepper-v1:';
const PBKDF2_ITERATIONS = 100_000;
const LEGACY_PBKDF2_ITERATIONS = 310_000;
const MAX_AUTH_BODY_BYTES = 16_384;
const VALID_GENDERS = new Set(['female', 'male', 'prefer-not-to-say']);
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export function authJson(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function cookieValue(request, name) {
  const prefix = `${name}=`;
  const item = (request.headers.get('cookie') || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return item ? item.slice(prefix.length) : '';
}

function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

function makeCookie(value, maxAge) {
  const lifetime = maxAge === undefined ? '' : `; Max-Age=${maxAge}`;
  return `${SESSION_COOKIE}=${value}; Path=/${lifetime}; HttpOnly; Secure; SameSite=Lax`;
}

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function hasPasswordPepper(pepper) {
  return typeof pepper === 'string' && /^[A-Za-z0-9_-]{43}$/.test(pepper);
}

function passwordPepperUnavailable() {
  return authJson({ error: '인증 서버 설정을 확인할 수 없습니다.', code: 'AUTH_HASH_CONFIG_UNAVAILABLE' }, 503);
}

async function hashPassword(password, salt, pepper) {
  let input = encoder.encode(password);
  if (pepper) {
    const secret = await crypto.subtle.importKey(
      'raw', decodeBase64Url(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    input = await crypto.subtle.sign('HMAC', secret, input);
  }
  const iterations = pepper ? PBKDF2_ITERATIONS : LEGACY_PBKDF2_ITERATIONS;
  const key = await crypto.subtle.importKey('raw', input, 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return new Uint8Array(derived);
}

async function readJson(request) {
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'application/json') {
    return authJson({ error: 'Content-Type은 application/json이어야 합니다.' }, 415);
  }
  if (!request.body) return authJson({ error: '올바른 JSON 형식이 아닙니다.' }, 400);

  const reader = request.body.getReader();
  const bytes = new Uint8Array(MAX_AUTH_BODY_BYTES);
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.byteLength > MAX_AUTH_BODY_BYTES) {
        await reader.cancel();
        return authJson({ error: '요청 본문이 너무 큽니다.' }, 413);
      }
      bytes.set(value, length);
      length += value.byteLength;
    }
    const body = JSON.parse(decoder.decode(bytes.subarray(0, length)));
    if (body && typeof body === 'object' && !Array.isArray(body)) return body;
    return authJson({ error: '요청 형식이 올바르지 않습니다.' }, 400);
  } catch {
    return authJson({ error: '올바른 JSON 형식이 아닙니다.' }, 400);
  } finally {
    reader.releaseLock();
  }
}

async function createSession() {
  const token = new Uint8Array(32);
  crypto.getRandomValues(token);
  const tokenText = base64Url(token);
  const tokenDigest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(tokenText)));
  return {
    token: tokenText,
    hash: base64Url(tokenDigest),
    expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
  };
}

function sessionResponse(session, status, maxAge) {
  return authJson({ success: true }, status, { 'Set-Cookie': makeCookie(session.token, maxAge) });
}

async function ensureSchema(db) {
  const schema = await db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('members', 'auth_sessions')").first();
  if (schema?.count === 2) return;

  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT NOT NULL UNIQUE CHECK (length(trim(nickname)) BETWEEN 2 AND 20),
      email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(email)) BETWEEN 3 AND 254),
      gender TEXT NOT NULL CHECK (gender IN ('female', 'male', 'prefer-not-to-say')),
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      last_login_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_members_created_at ON members (created_at DESC)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_auth_sessions_member_id ON auth_sessions (member_id, expires_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at)'),
  ]);
}

export async function register(request, env) {
  if (!env.DB) return authJson({ error: 'D1 데이터베이스가 연결되지 않았습니다.' }, 503);
  if (!isSameOrigin(request)) return authJson({ error: '요청 출처를 확인할 수 없습니다.' }, 403);
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const gender = typeof body.gender === 'string' ? body.gender : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (nickname.length < 2 || nickname.length > 20) return authJson({ error: '닉네임은 2~20자로 입력해 주세요.' }, 400);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return authJson({ error: '올바른 이메일 주소를 입력해 주세요.' }, 400);
  if (!VALID_GENDERS.has(gender)) return authJson({ error: '성별 항목을 선택해 주세요.' }, 400);
  if (password.length < 8 || password.length > 128) return authJson({ error: '비밀번호는 8~128자로 입력해 주세요.' }, 400);
  const pepper = env.AUTH_PASSWORD_PEPPER;
  if (!hasPasswordPepper(pepper)) return passwordPepperUnavailable();

  try { await ensureSchema(env.DB); } catch (error) {
    console.error('Failed to initialize member tables', { error: error?.name });
    return authJson({ error: '회원 데이터베이스 연결 또는 스키마 설정을 확인할 수 없습니다.', code: 'AUTH_SCHEMA_UNAVAILABLE', stage: 'schema' }, 503);
  }

  let registrationStage = 'password_hash';
  try {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    const passwordHash = HASH_PREFIX + base64Url(await hashPassword(password, salt, pepper));
    registrationStage = 'member_and_session_insert';
    const session = await createSession();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO members (nickname, email, gender, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)')
        .bind(nickname, email, gender, passwordHash, base64Url(salt)),
      env.DB.prepare('INSERT INTO auth_sessions (token_hash, member_id, expires_at) VALUES (?, (SELECT id FROM members WHERE email = ? COLLATE NOCASE), ?)')
        .bind(session.hash, email, session.expiresAt),
    ]);
    return sessionResponse(session, 201, SESSION_TTL_SECONDS);
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('unique')) return authJson({ error: '이미 사용 중인 이메일 또는 닉네임입니다.' }, 409);
    console.error('Member registration failed', { stage: registrationStage, error: error?.name });
    return authJson({ error: '회원가입을 처리하지 못했습니다. 잠시 후 다시 시도하거나 운영자에게 문의해 주세요.' }, 500);
  }
}

export async function login(request, env) {
  if (!env.DB) return authJson({ error: 'D1 데이터베이스가 연결되지 않았습니다.' }, 503);
  if (!isSameOrigin(request)) return authJson({ error: '요청 출처를 확인할 수 없습니다.' }, 403);
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (email.length > 254 || !email || !password || password.length > 128) return authJson({ error: '이메일 주소와 비밀번호를 확인해 주세요.' }, 400);

  try { await ensureSchema(env.DB); } catch (error) {
    console.error('Failed to initialize member tables', { error: error?.name });
    return authJson({ error: '회원 데이터베이스 연결 또는 스키마 설정을 확인할 수 없습니다.', code: 'AUTH_SCHEMA_UNAVAILABLE' }, 503);
  }

  try {
    const member = await env.DB.prepare('SELECT id, password_hash, password_salt FROM members WHERE email = ? COLLATE NOCASE')
      .bind(email)
      .first();
    if (!member) return authJson({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
    const versioned = member.password_hash.startsWith(HASH_PREFIX);
    const pepper = versioned ? env.AUTH_PASSWORD_PEPPER : undefined;
    if (versioned && !hasPasswordPepper(pepper)) return passwordPepperUnavailable();
    const calculated = await hashPassword(password, decodeBase64Url(member.password_salt), pepper);
    const stored = decodeBase64Url(versioned ? member.password_hash.slice(HASH_PREFIX.length) : member.password_hash);
    if (calculated.byteLength !== stored.byteLength || !crypto.subtle.timingSafeEqual(calculated, stored)) {
      return authJson({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
    }
    const session = await createSession();
    await env.DB.batch([
      env.DB.prepare('UPDATE members SET last_login_at = ? WHERE id = ?').bind(new Date().toISOString(), member.id),
      env.DB.prepare('INSERT INTO auth_sessions (token_hash, member_id, expires_at) VALUES (?, ?, ?)')
        .bind(session.hash, member.id, session.expiresAt),
    ]);
    return sessionResponse(session, 200, body.remember === false ? undefined : SESSION_TTL_SECONDS);
  } catch (error) {
    if (/(?:iterations|iteration counts?) above \d+ are not supported/i.test(error?.message ?? '')) {
      return authJson({ error: '이 환경에서 비밀번호 해시를 확인할 수 없습니다.', code: 'AUTH_PBKDF2_LIMIT' }, 503);
    }
    console.error('Member login failed', { error: error?.name });
    return authJson({ error: '로그인을 처리하지 못했습니다.' }, 500);
  }
}

export async function logout(request, env) {
  if (!env.DB) return authJson({ error: 'D1 데이터베이스가 연결되지 않았습니다.' }, 503);
  if (!isSameOrigin(request)) return authJson({ error: '요청 출처를 확인할 수 없습니다.' }, 403);
  const token = cookieValue(request, SESSION_COOKIE);
  if (token) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
    await env.DB.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL')
      .bind(new Date().toISOString(), base64Url(digest))
      .run();
  }
  return authJson({ success: true }, 200, { 'Set-Cookie': makeCookie('', 0) });
}

export async function getCurrentMember(request, env) {
  if (!env.DB) return authJson({ error: 'D1 데이터베이스가 연결되지 않았습니다.' }, 503);
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return authJson({ authenticated: false }, 401);
  try { await ensureSchema(env.DB); } catch (error) {
    console.error('Failed to initialize member tables', { error: error?.name });
    return authJson({ error: '회원 데이터베이스 연결 또는 스키마 설정을 확인할 수 없습니다.', code: 'AUTH_SCHEMA_UNAVAILABLE' }, 503);
  }
  try {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
    const member = await env.DB.prepare(
      `SELECT m.id, m.nickname, m.email
       FROM auth_sessions s JOIN members m ON m.id = s.member_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?`,
    )
      .bind(base64Url(digest), new Date().toISOString())
      .first();
    return member ? authJson({ authenticated: true, member }) : authJson({ authenticated: false }, 401);
  } catch (error) {
    console.error('Session lookup failed', { error: error?.name });
    return authJson({ error: '로그인 상태를 확인하지 못했습니다.' }, 500);
  }
}

export async function authHealth(env) {
  if (!env.DB) return authJson({ ok: false, binding: 'missing' }, 503);
  try {
    const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'members'").first();
    return authJson({ ok: true, binding: 'connected', memberSchema: Number(row?.count) > 0 });
  } catch {
    return authJson({ ok: false, binding: 'unavailable' }, 503);
  }
}
