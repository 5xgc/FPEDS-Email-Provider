"""Self-hosted MoralTown webmail service.

Brevo handles outbound transactional messages and Mailgun handles inbound
message routing. Groq is optional for spam scoring.
"""

from __future__ import annotations

import hashlib
import fcntl
import hmac
import html
import os
import re
import secrets
import sqlite3
import subprocess
import threading
from base64 import urlsafe_b64encode
from datetime import datetime, timedelta, timezone
from email.utils import parseaddr
from pathlib import Path
from typing import Any
from urllib import error as urlerror
from urllib import request as urlrequest
from urllib.parse import quote, urlsplit
import json
import logging
import time
from decimal import Decimal, InvalidOperation
from collections import OrderedDict
from werkzeug.middleware.proxy_fix import ProxyFix

from cryptography.fernet import Fernet, InvalidToken
from flask import Flask, jsonify, request, send_from_directory, session
from crypto_payments import (
    ASSETS as PAYMENT_ASSETS,
    PaymentProviderError,
    address_and_start_height,
    amount_units_for_usd,
    find_payment,
    format_units,
    purchase_proof,
    spot_usd,
    valid_purchase_proof,
)


ROOT = Path(__file__).resolve().parent
STATIC_DIR_CANDIDATES = (
    ROOT / "dist" / "public",
    ROOT / "artifacts" / "fpeds" / "dist" / "public",
)
STATIC_DIR = next(
    (candidate for candidate in STATIC_DIR_CANDIDATES if candidate.exists()),
    STATIC_DIR_CANDIDATES[0],
)
DATABASE_PATH = Path(os.environ.get("SQLITE_PATH", str(ROOT / "data" / "fpeds.sqlite3")))
MAIL_DOMAIN = (
    os.environ.get("FPEDS_MAIL_DOMAIN")
    or os.environ.get("MAIL_DOMAIN")
    or "fpdf.2bd.net"
).strip().lower()
if not re.fullmatch(r"[a-z0-9.-]+", MAIL_DOMAIN):
    raise RuntimeError("FPEDS_MAIL_DOMAIN must be a valid domain name.")
BREVO_SENDER_DOMAIN = (
    os.environ.get("BREVO_SENDER_DOMAIN") or "fpeds.2bd.net"
).strip().lower()
if not re.fullmatch(r"[a-z0-9.-]+", BREVO_SENDER_DOMAIN):
    raise RuntimeError("BREVO_SENDER_DOMAIN must be a valid domain name.")

IS_PRODUCTION = (
    os.environ.get("FLASK_ENV") == "production"
    or os.environ.get("RENDER", "").lower() == "true"
)
SESSION_SECRET = os.environ.get("SESSION_SECRET", "").strip()
if IS_PRODUCTION and len(SESSION_SECRET) < 32:
    raise RuntimeError(
        "Set SESSION_SECRET to a random value of at least 32 characters in production."
    )

app = Flask(
    __name__,
    static_folder=str(STATIC_DIR) if STATIC_DIR.exists() else None,
)
logging.getLogger("werkzeug").disabled = True
logging.getLogger("gunicorn.access").disabled = True
logging.getLogger("gunicorn.error").disabled = True
app.logger.disabled = True
app.config.update(
    SECRET_KEY=SESSION_SECRET or "local-development-session-secret",
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_NAME="fpeds_session",
    SESSION_COOKIE_PERMANENT=True,
    PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 30,
    SESSION_COOKIE_SECURE=(
        os.environ.get("FLASK_ENV") == "production"
        or os.environ.get("RENDER", "").lower() == "true"
    ),
    MAX_CONTENT_LENGTH=1_200_000,
)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

# Replit/Render terminate TLS and forward one trusted client address to Flask.
# The app limiter is a second layer; use provider-level edge filtering for DDoS.
RATE_LIMITS: OrderedDict[tuple[str, str], tuple[float, int]] = OrderedDict()
RATE_LIMIT_LOCK = threading.Lock()
RATE_LIMIT_MAX_CLIENTS = 20_000
RATE_LIMIT_RULES = {
    "api": (240, 60),
    "auth": (12, 60),
    "captcha": (30, 60),
    "send": (12, 60),
}

FREE_ACCESS_CODE = os.environ.get("MORALTOWN_ACCESS_CODE", "").strip()
ADMIN_ACCESS_KEY = os.environ.get("MORALTOWN_ADMIN_ACCESS_KEY", "").strip()
PAYMENT_EXPIRY_SECONDS = 60 * 60 * 2
PAYMENT_CHECK_INTERVAL_SECONDS = 30
PAYMENT_MONITOR_INTERVAL_SECONDS = 5
PAYMENT_EMAIL_RETRY_SECONDS = 60


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def db_connection() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


def init_db() -> None:
    with db_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              access_key_hash TEXT NOT NULL UNIQUE,
              access_key_ciphertext TEXT,
              access_key_lookup_hash TEXT UNIQUE,
              username TEXT NOT NULL UNIQUE,
              email TEXT NOT NULL UNIQUE,
              role TEXT NOT NULL DEFAULT 'user',
              purchase_email TEXT,
              email_changes_remaining INTEGER NOT NULL DEFAULT 2,
              email_change_year INTEGER NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              deletion_requested_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS messages (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              folder TEXT NOT NULL DEFAULT 'inbox',
              sender TEXT NOT NULL,
              recipient TEXT NOT NULL,
              subject TEXT NOT NULL,
              body TEXT NOT NULL,
              content_encrypted INTEGER NOT NULL DEFAULT 0,
              received_at TEXT NOT NULL,
              is_read INTEGER NOT NULL DEFAULT 0,
              is_starred INTEGER NOT NULL DEFAULT 0,
              spam_score REAL NOT NULL DEFAULT 0,
              blocked INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS messages_user_folder_idx
              ON messages(user_id, folder, received_at);

            CREATE TABLE IF NOT EXISTS folders (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              name TEXT NOT NULL,
              created_at TEXT NOT NULL,
              UNIQUE(user_id, name)
            );

            CREATE TABLE IF NOT EXISTS notifications (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              kind TEXT NOT NULL,
              title TEXT NOT NULL,
              message TEXT NOT NULL,
              created_at TEXT NOT NULL,
              is_read INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS subscriptions (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              email TEXT NOT NULL,
              label TEXT NOT NULL,
              active INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS payment_orders (
              id TEXT PRIMARY KEY,
              currency TEXT NOT NULL,
              address TEXT NOT NULL,
              derive_index INTEGER,
              amount_units TEXT NOT NULL,
              amount_text TEXT NOT NULL,
              price_usd TEXT NOT NULL,
              start_height INTEGER NOT NULL DEFAULT 0,
              status TEXT NOT NULL DEFAULT 'pending',
              received_units TEXT NOT NULL DEFAULT '0',
              transaction_id TEXT,
              confirmations INTEGER NOT NULL DEFAULT 0,
              last_checked_at INTEGER NOT NULL DEFAULT 0,
              created_at INTEGER NOT NULL,
              expires_at INTEGER NOT NULL,
              claimed_at INTEGER,
              contact_email TEXT,
              claim_token_hash TEXT,
              claim_token_ciphertext TEXT,
              claim_origin TEXT,
              confirmation_email_sent_at INTEGER,
              confirmation_email_attempted_at INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS payment_orders_currency_status_idx
              ON payment_orders(currency, status, expires_at);

            CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_currency_amount_idx
              ON payment_orders(currency, amount_units);

            CREATE TABLE IF NOT EXISTS account_deletion_jobs (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              token_hash TEXT NOT NULL UNIQUE,
              started_at INTEGER NOT NULL,
              completes_at INTEGER NOT NULL,
              next_check_at INTEGER NOT NULL,
              checks_done INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS account_deletion_jobs_due_idx
              ON account_deletion_jobs(next_check_at);

            CREATE TABLE IF NOT EXISTS system_settings (
              setting_key TEXT PRIMARY KEY,
              setting_value TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS site_announcements (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              message TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS admin_audit_log (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              action TEXT NOT NULL,
              actor TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS captcha_challenges (
              token_hash TEXT PRIMARY KEY,
              answer_hash TEXT NOT NULL,
              expires_at INTEGER NOT NULL,
              created_at INTEGER NOT NULL
            );
            """
        )
        try:
            connection.execute("ALTER TABLE users ADD COLUMN access_key_ciphertext TEXT")
        except sqlite3.OperationalError as exc:
            if "duplicate column name" not in str(exc).lower():
                raise
        migrations = (
            ("users", "access_key_lookup_hash", "TEXT"),
            ("users", "role", "TEXT NOT NULL DEFAULT 'user'"),
            ("messages", "content_encrypted", "INTEGER NOT NULL DEFAULT 0"),
            ("users", "deletion_requested_at", "INTEGER"),
            ("users", "purchase_email", "TEXT"),
            ("payment_orders", "contact_email", "TEXT"),
            ("payment_orders", "claim_token_hash", "TEXT"),
            ("payment_orders", "claim_token_ciphertext", "TEXT"),
            ("payment_orders", "claim_origin", "TEXT"),
            ("payment_orders", "confirmation_email_sent_at", "INTEGER"),
            (
                "payment_orders",
                "confirmation_email_attempted_at",
                "INTEGER NOT NULL DEFAULT 0",
            ),
        )
        for table, column, definition in migrations:
            existing_columns = {
                row["name"]
                for row in connection.execute(f"PRAGMA table_info({table})")
            }
            if column not in existing_columns:
                connection.execute(
                    f"ALTER TABLE {table} ADD COLUMN {column} {definition}"
                )
        connection.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS users_access_key_lookup_hash_idx
            ON users(access_key_lookup_hash) WHERE access_key_lookup_hash IS NOT NULL
            """
        )
        now = utc_now()
        for key, value in (
            ("lockdown", "0"),
            ("lockdown_message", "WEBSITE SHUT DOWN BY ADMIN | WILL BE BACK SOON"),
            ("api_paused", "0"),
            ("sending_enabled", "1"),
            ("receiving_enabled", "1"),
        ):
            connection.execute(
                """
                INSERT OR IGNORE INTO system_settings(setting_key, setting_value, updated_at)
                VALUES (?, ?, ?)
                """,
                (key, value, now),
            )
        connection.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS users_purchase_email_idx
            ON users(purchase_email) WHERE purchase_email IS NOT NULL
            """
        )
        # Keep existing accounts aligned when the mailbox domain is changed
        # from the original FPEDS domain to the configured receiving domain.
        for row in connection.execute(
            "SELECT id, username, email FROM users WHERE deletion_requested_at IS NULL"
        ).fetchall():
            expected_email = mailbox_address(row["username"])
            if row["email"] != expected_email:
                connection.execute(
                    "UPDATE users SET email = ?, updated_at = ? WHERE id = ?",
                    (expected_email, utc_now(), row["id"]),
                )
        # Backfill fast lookup hashes for existing high-entropy access keys and
        # encrypt legacy plaintext mail before serving the first request.
        for row in connection.execute(
            """
            SELECT id, access_key_ciphertext FROM users
            WHERE access_key_lookup_hash IS NULL AND access_key_ciphertext IS NOT NULL
            """
        ).fetchall():
            key = decrypt_access_key(row["access_key_ciphertext"])
            if key:
                connection.execute(
                    "UPDATE users SET access_key_lookup_hash = ? WHERE id = ?",
                    (hash_access_key_lookup(key), row["id"]),
                )
        for row in connection.execute(
            """
            SELECT id, sender, recipient, subject, body FROM messages
            WHERE content_encrypted = 0
            """
        ).fetchall():
            connection.execute(
                """
                UPDATE messages
                SET sender = ?, recipient = ?, subject = ?, body = ?, content_encrypted = 1
                WHERE id = ?
                """,
                (
                    encrypt_mailbox_text(row["sender"]),
                    encrypt_mailbox_text(row["recipient"]),
                    encrypt_mailbox_text(row["subject"]),
                    encrypt_mailbox_text(row["body"]),
                    row["id"],
                ),
            )
        connection.execute(
            "DELETE FROM captcha_challenges WHERE expires_at < ?",
            (int(time.time()),),
        )


def new_id() -> str:
    return secrets.token_urlsafe(18)


def hash_access_key(access_key: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", access_key.encode(), salt, 210_000)
    return f"pbkdf2_sha256$210000${salt.hex()}${digest.hex()}"


def hash_access_key_lookup(access_key: str) -> str:
    """Index high-entropy access keys without scanning every account at login."""
    return hashlib.sha256(access_key.encode("utf-8")).hexdigest()


def check_access_key(access_key: str, stored: str) -> bool:
    try:
        algorithm, rounds, salt_hex, digest_hex = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256",
            access_key.encode(),
            bytes.fromhex(salt_hex),
            int(rounds),
        )
        return hmac.compare_digest(candidate.hex(), digest_hex)
    except (TypeError, ValueError):
        return False


ACCOUNT_DELETION_SECONDS = 4 * 60


def credential_fernet() -> Fernet:
    """Use the server session secret as the key-encryption root of trust."""
    secret = os.environ.get("SESSION_SECRET", "local-development-session-secret").encode()
    return Fernet(urlsafe_b64encode(hashlib.sha256(secret).digest()))


def encrypt_access_key(access_key: str) -> str:
    return credential_fernet().encrypt(access_key.encode()).decode()


def decrypt_access_key(ciphertext: str) -> str | None:
    try:
        return credential_fernet().decrypt(ciphertext.encode()).decode()
    except (InvalidToken, ValueError, UnicodeDecodeError):
        return None


def encrypt_mailbox_text(value: str) -> str:
    return credential_fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_mailbox_text(value: str) -> str:
    try:
        return credential_fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, UnicodeDecodeError) as exc:
        raise RuntimeError(
            "Stored mailbox data could not be decrypted. Verify that SESSION_SECRET "
            "matches the secret used when the data was stored."
        ) from exc


def generate_access_key() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(50))


def normalize_username(username: str) -> str:
    return re.sub(r"[^a-z0-9._-]", "", username.strip().lower())


def valid_username(username: str) -> bool:
    return bool(1 <= len(username) <= 40 and re.search(r"[a-z]", username, re.I))


def valid_access_key(access_key: str) -> bool:
    return bool(re.fullmatch(r"\d{50}", access_key.strip()))


def accepts_free_access_code(supplied: str) -> bool:
    return bool(FREE_ACCESS_CODE) and hmac.compare_digest(
        supplied.encode("utf-8"), FREE_ACCESS_CODE.encode("utf-8")
    )


def role_for_user(row: sqlite3.Row | dict[str, Any]) -> str:
    try:
        role = str(row["role"] or "user")
    except (KeyError, IndexError):
        role = "user"
    allowed = {"user", "soldier", "moraltown", "admin", "co_founder", "og", "fed"}
    return role if role in allowed else "user"


def admin_account() -> dict[str, Any]:
    return {
        "id": "system-admin",
        "username": "MoralTown Admin",
        "email": "",
        "created_at": "system",
        "email_changes_remaining": 0,
        "role": "admin",
    }


def is_admin_login_key(access_key: str) -> bool:
    return bool(
        valid_access_key(ADMIN_ACCESS_KEY)
        and hmac.compare_digest(access_key.encode("utf-8"), ADMIN_ACCESS_KEY.encode("utf-8"))
    )


def has_management_permission(user: sqlite3.Row | dict[str, Any]) -> bool:
    return role_for_user(user) in {"admin", "co_founder"}


def require_admin_account(user: sqlite3.Row | dict[str, Any]) -> bool:
    return bool(session.get("admin_authenticated")) or role_for_user(user) == "admin"


def load_system_settings() -> dict[str, str]:
    with db_connection() as connection:
        rows = connection.execute(
            "SELECT setting_key, setting_value FROM system_settings"
        ).fetchall()
    return {row["setting_key"]: row["setting_value"] for row in rows}


def control_state() -> dict[str, Any]:
    settings = load_system_settings()
    return {
        "lockdown": settings.get("lockdown", "0") == "1",
        "lockdownMessage": settings.get(
            "lockdown_message", "WEBSITE SHUT DOWN BY ADMIN | WILL BE BACK SOON"
        ),
        "apiPaused": settings.get("api_paused", "0") == "1",
        "sendingEnabled": settings.get("sending_enabled", "1") == "1",
        "receivingEnabled": settings.get("receiving_enabled", "1") == "1",
    }


def write_system_setting(key: str, value: str) -> None:
    with db_connection() as connection:
        connection.execute(
            """
            INSERT INTO system_settings(setting_key, setting_value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(setting_key) DO UPDATE SET
              setting_value = excluded.setting_value,
              updated_at = excluded.updated_at
            """,
            (key, value, utc_now()),
        )


def write_admin_audit(action: str, actor: str) -> None:
    with db_connection() as connection:
        connection.execute(
            "INSERT INTO admin_audit_log(action, actor, created_at) VALUES (?, ?, ?)",
            (action[:180], actor[:80], utc_now()),
        )


def mailbox_address(username: str) -> str:
    return f"{username}@{MAIL_DOMAIN}"


def public_user(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "createdAt": row["created_at"],
        "emailChangesRemaining": row["email_changes_remaining"],
        "role": role_for_user(row),
    }


def public_message(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    try:
        content_encrypted = bool(row["content_encrypted"])
    except (KeyError, IndexError):
        content_encrypted = False
    sender = row["sender"]
    recipient = row["recipient"]
    subject = row["subject"]
    body = row["body"]
    if content_encrypted:
        sender = decrypt_mailbox_text(sender)
        recipient = decrypt_mailbox_text(recipient)
        subject = decrypt_mailbox_text(subject)
        body = decrypt_mailbox_text(body)
    return {
        "id": row["id"],
        "folder": row["folder"],
        "from": sender,
        "to": recipient,
        "subject": subject,
        "preview": re.sub(r"\s+", " ", body)[:140],
        "body": body,
        "receivedAt": row["received_at"],
        "isRead": bool(row["is_read"]),
        "isStarred": bool(row["is_starred"]),
        "spamScore": row["spam_score"],
        "blocked": bool(row["blocked"]),
    }


def current_user() -> sqlite3.Row | None:
    if session.get("admin_authenticated") and valid_access_key(ADMIN_ACCESS_KEY):
        return admin_account()  # type: ignore[return-value]
    user_id = session.get("user_id")
    if not user_id:
        return None
    with db_connection() as connection:
        return connection.execute(
            "SELECT * FROM users WHERE id = ? AND deletion_requested_at IS NULL",
            (user_id,),
        ).fetchone()


def require_user() -> sqlite3.Row:
    user = current_user()
    if not user:
        raise PermissionError("Sign in required")
    return user


def error_response(message: str, status: int):
    return jsonify({"error": message}), status


def html_to_text(value: str) -> str:
    value = re.sub(r"<style[^>]*>.*?</style>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<script[^>]*>.*?</script>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = re.sub(r"</p\s*>", "\n", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"[ \t]+\n", "\n", html.unescape(value)).strip()


def heuristic_spam_score(subject: str, body: str) -> float:
    return 0.92 if re.search(
        r"winner|urgent|wire transfer|crypto|password reset|claim now|free money",
        f"{subject}\n{body}",
        re.I,
    ) else 0.04


def classify_spam(subject: str, body: str) -> float:
    heuristic = heuristic_spam_score(subject, body)
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return heuristic
    payload = json.dumps(
        {
            "model": os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant"),
            "temperature": 0,
            "max_tokens": 10,
            "messages": [
                {
                    "role": "system",
                    "content": "Return only a number from 0 to 1. It is the probability an email is spam. Do not explain.",
                },
                {"role": "user", "content": f"Subject: {subject}\n\n{body[:4000]}"},
            ],
        }
    ).encode()
    try:
        groq_request = urlrequest.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urlrequest.urlopen(groq_request, timeout=8) as response:
            data = json.loads(response.read().decode())
        content = str(data.get("choices", [{}])[0].get("message", {}).get("content", ""))
        match = re.search(r"(?:0?\.\d+|1(?:\.0+)?)", content)
        if match:
            return max(0.0, min(1.0, float(match.group(0))))
    except (OSError, ValueError, KeyError, IndexError, urlerror.URLError):
        pass
    return heuristic


def add_notification(user_id: str, title: str, message: str, kind: str) -> None:
    with db_connection() as connection:
        connection.execute(
            """
            INSERT INTO notifications (id, user_id, kind, title, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (new_id(), user_id, kind, title, message, utc_now()),
        )


def extract_first(value: Any) -> str:
    if isinstance(value, list):
        return extract_first(value[0]) if value else ""
    if isinstance(value, dict):
        for key in ("email", "Email", "address", "Address", "value", "Value"):
            if value.get(key):
                return str(value[key]).strip()
        return ""
    return str(value or "").strip()


def extract_inbound_payload(payload: dict[str, Any]) -> tuple[str, str, str, str]:
    sender = extract_first(
        payload.get("sender")
        or payload.get("from")
        or payload.get("From")
        or payload.get("Sender")
        or payload.get("source")
        or payload.get("envelope", {}).get("from")
    )
    recipient = extract_first(
        payload.get("recipient")
        or payload.get("to")
        or payload.get("To")
        or payload.get("Recipients")
        or payload.get("recipient-override")
        or payload.get("received_for")
        or payload.get("delivered_to")
        or payload.get("envelope", {}).get("to")
    )
    subject = extract_first(
        payload.get("subject")
        or payload.get("Subject")
        or payload.get("headers", {}).get("subject")
    )
    body = extract_first(
        payload.get("text")
        or payload.get("body")
        or payload.get("body_text")
        or payload.get("plain")
        or payload.get("body-plain")
        or payload.get("stripped-text")
        or payload.get("textContent")
        or payload.get("ExtractedMarkdownMessage")
        or payload.get("TextBody")
        or payload.get("RawTextBody")
    )
    if not body:
        body = html_to_text(extract_first(payload.get("html") or payload.get("body_html")))
    sender = parseaddr(sender)[1] or sender
    recipient = parseaddr(recipient)[1] or recipient
    return sender.strip(), recipient.strip().lower(), subject.strip(), body.strip()


def store_inbound(sender: str, recipient: str, subject: str, body: str) -> bool:
    username, domain = recipient.rsplit("@", 1) if "@" in recipient else ("", "")
    if domain.lower() != MAIL_DOMAIN or not valid_username(username):
        return False
    with db_connection() as connection:
        owner = connection.execute(
            "SELECT * FROM users WHERE username = ?", (username.lower(),)
        ).fetchone()
        if not owner:
            return False
    spam_score = classify_spam(subject, body)
    blocked = spam_score >= 0.75
    with db_connection() as connection:
        connection.execute(
            """
            INSERT INTO messages
              (id, user_id, folder, sender, recipient, subject, body,
               content_encrypted, received_at, spam_score, blocked)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
            """,
            (
                new_id(),
                owner["id"],
                "spam" if blocked else "inbox",
                encrypt_mailbox_text(sender),
                encrypt_mailbox_text(recipient),
                encrypt_mailbox_text(subject),
                encrypt_mailbox_text(body),
                utc_now(),
                spam_score,
                int(blocked),
            ),
        )
    if blocked:
        add_notification(
            owner["id"],
            "Spam email blocked",
            f"A message from {sender} was moved to Spam by MoralTown protection.",
            "spam",
        )
    return True


class MailConfigurationError(RuntimeError):
    """The service is missing a required mail setting."""


class BrevoDeliveryError(RuntimeError):
    """Brevo rejected or could not accept an outbound message."""


def brevo_provider_error(exc: urlerror.HTTPError) -> str:
    """Return Brevo's safe error message without exposing request credentials."""
    try:
        response_body = exc.read().decode("utf-8", errors="replace")
        provider_error = json.loads(response_body)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        provider_error = {}
    provider_message = (
        provider_error.get("message")
        if isinstance(provider_error, dict)
        else None
    )
    provider_code = (
        provider_error.get("code")
        if isinstance(provider_error, dict)
        else None
    )
    if provider_message:
        suffix = f" ({provider_code})" if provider_code else ""
        return f"Brevo rejected the message: {provider_message}{suffix}"
    return "Brevo rejected the message. Verify the sender domain and recipient."


def send_brevo_through_replit_connector(payload: dict[str, Any]) -> bool | None:
    """Use the attached Brevo connector when running inside Replit.

    Render does not provide Replit connector runtime variables, so returning
    None lets the caller use the deployment's BREVO_API_KEY fallback there.
    """
    if not os.environ.get("REPLIT_CONNECTORS_HOSTNAME"):
        return None
    try:
        completed = subprocess.run(
            ["node", str(ROOT / "scripts" / "brevo-send.mjs")],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        result = json.loads(completed.stdout or "{}")
    except (
        OSError,
        subprocess.SubprocessError,
        json.JSONDecodeError,
    ) as exc:
        raise BrevoDeliveryError(
            "The connected Brevo service could not be reached from Replit."
        ) from exc
    if completed.returncode != 0 or not isinstance(result, dict):
        raise BrevoDeliveryError(
            "The connected Brevo service could not send the message from Replit."
        )
    if result.get("ok"):
        return True
    provider_message = result.get("message")
    if provider_message:
        raise BrevoDeliveryError(f"Brevo rejected the message: {provider_message}")
    raise BrevoDeliveryError("Brevo rejected the message from the connected service.")


def send_brevo_message(
    user: sqlite3.Row, recipient: str, subject: str, body: str
) -> None:
    sender_email = f"{user['username']}@{BREVO_SENDER_DOMAIN}"
    sender_name = os.environ.get("BREVO_SENDER_NAME", "MoralTown").strip() or "MoralTown"
    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "replyTo": {"name": user["username"], "email": user["email"]},
        "to": [{"email": recipient}],
        "subject": subject,
        "textContent": body,
    }
    connector_result = send_brevo_through_replit_connector(payload)
    if connector_result is True:
        return

    api_key = os.environ.get("BREVO_API_KEY", "").strip()
    if not api_key:
        raise MailConfigurationError(
            "Brevo is not configured. Connect Brevo in Replit or add BREVO_API_KEY in Render."
        )
    request = urlrequest.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "accept": "application/json",
            "api-key": api_key,
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urlrequest.urlopen(request, timeout=25) as response:
            if response.status < 200 or response.status >= 300:
                raise BrevoDeliveryError("Brevo did not accept the message.")
    except urlerror.HTTPError as exc:
        if exc.code in {401, 403}:
            raise BrevoDeliveryError(
                brevo_provider_error(exc)
            ) from exc
        if 400 <= exc.code < 500:
            raise BrevoDeliveryError(brevo_provider_error(exc)) from exc
        raise BrevoDeliveryError(
            "Brevo could not deliver the message right now."
        ) from exc
    except (urlerror.URLError, TimeoutError, OSError) as exc:
        raise BrevoDeliveryError(
            "Brevo could not be reached. Check the Render service network and try again."
        ) from exc


class PaymentConfirmationEmailError(RuntimeError):
    """The payment confirmation email could not be sent."""


def send_resend_payment_confirmation(
    recipient: str, claim_url: str, order_id: str
) -> None:
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        raise PaymentConfirmationEmailError(
            "Payment confirmation email is not configured."
        )
    safe_url = html.escape(claim_url, quote=True)
    text = (
        "Your MoralTown payment has been confirmed. "
        "Open this one-time account-creation link whenever you are ready:\n\n"
        f"{claim_url}\n\n"
        "The link does not expire, but it can create only one account."
    )
    payload = {
        "from": "auth@fpeds.2bd.net",
        "to": [recipient],
        "subject": "Your MoralTown payment is confirmed",
        "text": text,
        "html": (
            "<div style=\"font-family:Arial,sans-serif;max-width:560px;margin:auto;"
            "padding:32px;color:#f5f5f5;background:#101010\">"
            "<p style=\"color:#ed3434;font-size:12px;letter-spacing:2px;"
            "text-transform:uppercase\">MoralTown</p>"
            "<h1 style=\"font-size:26px\">Payment confirmed</h1>"
            "<p>Your payment has been verified on the blockchain.</p>"
            "<p>Use the link below whenever you are ready to create your account. "
            "It does not expire and can be used once.</p>"
            f"<p><a href=\"{safe_url}\" style=\"display:inline-block;padding:14px 22px;"
            "border-radius:10px;background:#e32e35;color:#fff;text-decoration:none;"
            "font-weight:bold\">Create your account</a></p>"
            "<p style=\"font-size:12px;color:#aaa\">If the button does not work, "
            f"copy this link into your browser:<br><a href=\"{safe_url}\" "
            f"style=\"color:#ff5b60\">{safe_url}</a></p></div>"
        ),
    }
    email_request = urlrequest.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Idempotency-Key": f"moraltown-payment-confirmation-{order_id}",
        },
        method="POST",
    )
    try:
        with urlrequest.urlopen(email_request, timeout=25) as response:
            if response.status < 200 or response.status >= 300:
                raise PaymentConfirmationEmailError(
                    f"Resend returned HTTP {response.status}."
                )
    except urlerror.HTTPError as exc:
        raise PaymentConfirmationEmailError(
            f"Resend returned HTTP {exc.code}."
        ) from exc
    except (urlerror.URLError, TimeoutError, OSError) as exc:
        raise PaymentConfirmationEmailError(
            "Resend could not be reached."
        ) from exc


class MailgunReceivingError(RuntimeError):
    """Mailgun rejected or could not parse an inbound message."""


def verify_mailgun_signature(timestamp: str, token: str, signature: str) -> None:
    signing_key = os.environ.get("MAILGUN_SIGNING_KEY", "").strip()
    if not signing_key:
        raise MailConfigurationError(
            "Mailgun receiving is not configured. Add MAILGUN_SIGNING_KEY in Render."
        )
    if not timestamp or not token or not signature:
        raise MailgunReceivingError("Mailgun webhook signature is missing.")
    digest = hmac.new(
        signing_key.encode("utf-8"),
        f"{timestamp}{token}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(digest, signature):
        raise MailgunReceivingError("Invalid Mailgun webhook signature.")


def handle_mailgun_inbound(payload: dict[str, Any]) -> tuple[str, str, str, str]:
    signature = payload.get("signature")
    if isinstance(signature, dict):
        timestamp = str(signature.get("timestamp", ""))
        token = str(signature.get("token", ""))
        digest = str(signature.get("signature", ""))
    else:
        timestamp = str(payload.get("timestamp", ""))
        token = str(payload.get("token", ""))
        digest = str(payload.get("signature", ""))
    verify_mailgun_signature(timestamp, token, digest)

    sender, recipient, subject, body = extract_inbound_payload(payload)
    if not sender or not recipient or not subject or not body:
        raise MailgunReceivingError(
            "Mailgun payload must include sender, recipient, subject, and body-plain."
        )
    return sender, recipient, subject, body


def handle_send():
    try:
        user = require_user()
    except PermissionError as exc:
        return error_response(str(exc), 401)
    data = request.get_json(silent=True) or {}
    recipient = str(data.get("to", "")).strip()
    subject = str(data.get("subject", "")).strip()
    body = str(data.get("body", "")).strip()
    if not recipient or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", recipient):
        return error_response("Recipient must be a valid email address.", 400)
    if not subject or len(subject) > 200 or not body or len(body) > 100_000:
        return error_response("Subject and message are required.", 400)
    try:
        send_brevo_message(user, recipient, subject, body)
    except MailConfigurationError as exc:
        return error_response(str(exc), 503)
    except BrevoDeliveryError as exc:
        return error_response(str(exc), 502)

    message = {
        "id": new_id(),
        "user_id": user["id"],
        "folder": "sent",
        "sender": user["email"],
        "recipient": recipient,
        "subject": subject,
        "body": body,
        "received_at": utc_now(),
        "is_read": 1,
        "is_starred": 0,
        "spam_score": 0,
        "blocked": 0,
    }
    with db_connection() as connection:
        connection.execute(
            """
            INSERT INTO messages
              (id, user_id, folder, sender, recipient, subject, body, received_at,
               is_read, is_starred, spam_score, blocked)
            VALUES (:id, :user_id, :folder, :sender, :recipient, :subject, :body,
                    :received_at, :is_read, :is_starred, :spam_score, :blocked)
            """,
            message,
        )
    return jsonify(public_message(message)), 201


def rate_limit_response(bucket: str, maximum: int, seconds: int):
    source = request.remote_addr or "unknown"
    source_hash = hashlib.sha256(source.encode("utf-8")).hexdigest()[:32]
    key = (bucket, source_hash)
    now = time.time()
    with RATE_LIMIT_LOCK:
        current = RATE_LIMITS.get(key)
        if current is None or now - current[0] >= seconds:
            RATE_LIMITS[key] = (now, 1)
            RATE_LIMITS.move_to_end(key)
            allowed = True
            retry_after = seconds
        else:
            started, count = current
            RATE_LIMITS[key] = (started, count + 1)
            RATE_LIMITS.move_to_end(key)
            allowed = count < maximum
            retry_after = max(1, int(seconds - (now - started)))
        if len(RATE_LIMITS) > RATE_LIMIT_MAX_CLIENTS:
            for _ in range(len(RATE_LIMITS) - RATE_LIMIT_MAX_CLIENTS):
                RATE_LIMITS.popitem(last=False)
    if allowed:
        return None
    response = error_response("Too many requests. Please wait and try again.", 429)
    response.headers["Retry-After"] = str(retry_after)
    return response


def captcha_answer_hash(token: str, answer: str) -> str:
    return hashlib.sha256(f"{token}:{answer.strip()}".encode("utf-8")).hexdigest()


def issue_captcha() -> dict[str, Any]:
    left = secrets.randbelow(8) + 2
    right = secrets.randbelow(8) + 2
    token = secrets.token_urlsafe(24)
    now = int(time.time())
    with db_connection() as connection:
        connection.execute(
            """
            INSERT INTO captcha_challenges(token_hash, answer_hash, expires_at, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (
                hashlib.sha256(token.encode("utf-8")).hexdigest(),
                captcha_answer_hash(token, str(left + right)),
                now + 300,
                now,
            ),
        )
        if now % 30 == 0:
            connection.execute(
                "DELETE FROM captcha_challenges WHERE expires_at < ?", (now,)
            )
    return {
        "token": token,
        "question": f"What is {left} + {right}?",
        "expiresAt": now + 300,
    }


def consume_captcha(payload: dict[str, Any]) -> bool:
    token = str(payload.get("captchaToken", "")).strip()
    answer = str(payload.get("captchaAnswer", "")).strip()
    if not token or len(token) > 128 or not re.fullmatch(r"\d{1,3}", answer):
        return False
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with db_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute(
            "SELECT answer_hash, expires_at FROM captcha_challenges WHERE token_hash = ?",
            (token_hash,),
        ).fetchone()
        if not row:
            return False
        connection.execute(
            "DELETE FROM captcha_challenges WHERE token_hash = ?", (token_hash,)
        )
    return int(row["expires_at"]) >= int(time.time()) and hmac.compare_digest(
        str(row["answer_hash"]), captcha_answer_hash(token, answer)
    )


def get_announcement() -> dict[str, str] | None:
    with db_connection() as connection:
        row = connection.execute(
            "SELECT message, updated_at FROM site_announcements WHERE id = 1"
        ).fetchone()
    if not row:
        return None
    return {"message": row["message"], "updatedAt": row["updated_at"]}


def security_status() -> dict[str, Any]:
    controls = control_state()
    session_crypto_active = len(SESSION_SECRET) >= 32
    outbound_active = bool(
        os.environ.get("BREVO_API_KEY", "").strip()
        or os.environ.get("REPLIT_CONNECTORS_HOSTNAME", "").strip()
    ) and bool(BREVO_SENDER_DOMAIN)
    inbound_active = bool(os.environ.get("MAILGUN_SIGNING_KEY", "").strip())
    services = [
        {
            "id": "session-encryption",
            "name": "Credential and mailbox encryption",
            "active": session_crypto_active,
            "detail": (
                "Encrypted mailbox fields require the same persistent SESSION_SECRET."
                if session_crypto_active
                else "Encryption is not configured with a strong session secret."
            ),
        },
        {
            "id": "outbound-mail",
            "name": "Outbound mail provider",
            "active": outbound_active and controls["sendingEnabled"],
            "detail": (
                "Provider credentials are present; values are never shown."
                if outbound_active
                else "Outbound mail provider is not configured."
            ),
        },
        {
            "id": "inbound-mail",
            "name": "Inbound mail signature verification",
            "active": inbound_active and controls["receivingEnabled"],
            "detail": (
                "Signed inbound delivery is configured; key values are never shown."
                if inbound_active
                else "Mailgun signing is not configured."
            ),
        },
        {
            "id": "captcha",
            "name": "One-use human-check challenges",
            "active": True,
            "detail": "Short-lived challenges are verified server-side and consumed once.",
        },
        {
            "id": "request-throttle",
            "name": "Application request throttling",
            "active": True,
            "detail": "Per-process limits cover API, authentication, challenge, and send routes.",
        },
        {
            "id": "api-controls",
            "name": "Server-enforced operating controls",
            "active": True,
            "detail": "Lockdown, API pause, send pause, and receive pause are enforced by Flask.",
        },
    ]
    ready = (
        session_crypto_active
        and outbound_active
        and inbound_active
        and controls["sendingEnabled"]
        and controls["receivingEnabled"]
        and not controls["apiPaused"]
        and not controls["lockdown"]
    )
    warnings = []
    if not session_crypto_active:
        warnings.append("Encryption is unavailable. Do not use the mailbox until SESSION_SECRET is configured.")
    if not outbound_active or not controls["sendingEnabled"]:
        warnings.append("Outbound mail is unavailable. Do not use the mailbox until sending checks are active.")
    if not inbound_active or not controls["receivingEnabled"]:
        warnings.append("Inbound mail is unavailable. Do not use the mailbox until receiving checks are active.")
    if controls["apiPaused"]:
        warnings.append("API traffic is paused by an administrator.")
    if controls["lockdown"]:
        warnings.append("The website is in administrator lockdown.")
    routes = []
    for rule in sorted(app.url_map.iter_rules(), key=lambda item: item.rule):
        if not rule.rule.startswith("/api/"):
            continue
        methods = sorted(method for method in (rule.methods or set()) if method not in {"HEAD", "OPTIONS"})
        is_public_control = rule.rule in {
            "/api/healthz",
            "/api/site/status",
            "/api/auth/signin",
            "/api/auth/signout",
            "/api/auth/me",
            "/api/security/captcha",
            "/api/security/check",
        } or rule.rule.startswith("/api/admin/")
        active = not controls["apiPaused"] or is_public_control
        if controls["lockdown"] and not is_public_control:
            active = False
        routes.append({"path": rule.rule, "methods": methods, "active": active})
    return {
        "mailboxReady": ready,
        "lockdown": controls["lockdown"],
        "lockdownMessage": controls["lockdownMessage"],
        "apiPaused": controls["apiPaused"],
        "announcement": get_announcement(),
        "warnings": warnings,
        "services": services,
        "routes": routes,
    }


@app.before_request
def protect_request():
    path = request.path
    is_webhook = path in {
        "/webhook/mailgun",
        "/api/webhook/mailgun",
        "/webhook/inbound",
        "/api/webhook/inbound",
    }
    if path.startswith("/api/"):
        for bucket, maximum, seconds in (
            ("api", *RATE_LIMIT_RULES["api"]),
            *(
                [("auth", *RATE_LIMIT_RULES["auth"])]
                if path.startswith("/api/auth/")
                else []
            ),
            *(
                [("captcha", *RATE_LIMIT_RULES["captcha"])]
                if path == "/api/security/captcha"
                else []
            ),
            *(
                [("send", *RATE_LIMIT_RULES["send"])]
                if path in {"/api/send", "/api/messages"}
                else []
            ),
        ):
            limited = rate_limit_response(bucket, maximum, seconds)
            if limited:
                return limited
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not is_webhook:
            origin = request.headers.get("Origin")
            if origin:
                parsed = urlsplit(origin)
                allowed_schemes = {"http", "https"}
                if (
                    parsed.scheme not in allowed_schemes
                    or not parsed.netloc
                    or parsed.netloc.lower() != request.host.lower()
                ):
                    return error_response("A same-origin request is required.", 403)

    if is_webhook:
        controls = control_state()
        if (
            not controls["receivingEnabled"]
            or controls["apiPaused"]
            or controls["lockdown"]
        ):
            return error_response("Inbound mail is paused by an administrator.", 503)

    if path.startswith("/api/"):
        controls = control_state()
        current = current_user() if (
            path.startswith("/api/admin/") or controls["lockdown"] or controls["apiPaused"]
        ) else None
        management_access = bool(current and has_management_permission(current))
        admin_access = bool(current and require_admin_account(current))
        auth_allowlist = {
            "/api/auth/signin",
            "/api/auth/signout",
            "/api/auth/me",
            "/api/security/captcha",
            "/api/security/check",
            "/api/site/status",
            "/api/healthz",
        }
        if controls["apiPaused"] and path not in auth_allowlist and not (
            path.startswith("/api/admin/") and management_access
        ):
            return error_response("API traffic is paused by an administrator.", 503)
        if controls["lockdown"] and path not in {
            "/api/auth/signin",
            "/api/auth/signout",
            "/api/auth/me",
            "/api/security/captcha",
            "/api/site/status",
            "/api/healthz",
        } and not (path.startswith("/api/admin/") and admin_access):
            return error_response("The website is shut down by an administrator.", 503)
    return None


@app.after_request
def add_privacy_headers(response):
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    if IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, max-age=0"
    if request.path.startswith(
        ("/api/", "/auth", "/checkout", "/inbox", "/starred", "/sent", "/drafts", "/spam", "/folder/", "/compose", "/settings")
    ):
        response.headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"
    return response


@app.get("/api/healthz")
def health():
    return jsonify(
        {
            "status": "ok",
            "mailDomain": MAIL_DOMAIN,
            "mailProvider": "brevo",
            "receivingProvider": "mailgun",
            "brevoConfigured": bool(
                os.environ.get("BREVO_API_KEY", "").strip()
                or os.environ.get("REPLIT_CONNECTORS_HOSTNAME", "").strip()
            ),
            "brevoSenderDomain": BREVO_SENDER_DOMAIN,
            "resendConfigured": bool(os.environ.get("RESEND_API_KEY", "").strip()),
            "mailgunDomain": os.environ.get("MAILGUN_DOMAIN", MAIL_DOMAIN),
            "mailgunReceivingConfigured": bool(
                os.environ.get("MAILGUN_SIGNING_KEY", "").strip()
            ),
        }
    )


@app.post("/api/auth/check-access-code")
def check_access_code():
    data = request.get_json(silent=True) or {}
    if not consume_captcha(data):
        return error_response("Complete the human check and try again.", 400)
    supplied = str(data.get("accessCode", "")).strip()
    valid = bool(supplied) and accepts_free_access_code(supplied)
    return jsonify({"valid": valid})


@app.get("/api/security/captcha")
def new_captcha():
    return jsonify(issue_captcha())


@app.get("/api/site/status")
def public_site_status():
    controls = control_state()
    return jsonify(
        {
            "lockdown": controls["lockdown"],
            "lockdownMessage": controls["lockdownMessage"],
            "announcement": get_announcement(),
        }
    )


@app.get("/api/security/check")
def security_check():
    if not current_user():
        return error_response("Sign in required.", 401)
    return jsonify(security_status())


def require_management_user(admin_only: bool = False):
    user = current_user()
    if not user:
        return None, error_response("Sign in required.", 401)
    if admin_only and not require_admin_account(user):
        return None, error_response("Only an admin account can change account roles.", 403)
    if not admin_only and not has_management_permission(user):
        return None, error_response("Admin or co-founder permission is required.", 403)
    return user, None


@app.get("/api/admin/overview")
def admin_overview():
    user, failure = require_management_user()
    if failure:
        return failure
    today = datetime.now(timezone.utc).date()
    days = [today - timedelta(days=offset) for offset in range(6, -1, -1)]
    first_day = days[0].isoformat()
    last_day = days[-1].isoformat()
    with db_connection() as connection:
        user_rows = connection.execute(
            """
            SELECT date(created_at) AS day, COUNT(*) AS count
            FROM users
            WHERE date(created_at) BETWEEN ? AND ? AND deletion_requested_at IS NULL
            GROUP BY date(created_at)
            """,
            (first_day, last_day),
        ).fetchall()
        message_rows = connection.execute(
            """
            SELECT date(received_at) AS day, COUNT(*) AS count
            FROM messages
            WHERE date(received_at) BETWEEN ? AND ?
            GROUP BY date(received_at)
            """,
            (first_day, last_day),
        ).fetchall()
        totals = {
            "users": connection.execute(
                "SELECT COUNT(*) FROM users WHERE deletion_requested_at IS NULL"
            ).fetchone()[0],
            "sentToday": connection.execute(
                "SELECT COUNT(*) FROM messages WHERE folder = 'sent' AND date(received_at) = ?",
                (today.isoformat(),),
            ).fetchone()[0],
            "receivedToday": connection.execute(
                "SELECT COUNT(*) FROM messages WHERE folder = 'inbox' AND date(received_at) = ?",
                (today.isoformat(),),
            ).fetchone()[0],
        }
        audit_rows = connection.execute(
            """
            SELECT action, actor, created_at
            FROM admin_audit_log ORDER BY id DESC LIMIT 20
            """
        ).fetchall()
    account_counts = {row["day"]: row["count"] for row in user_rows}
    message_counts = {row["day"]: row["count"] for row in message_rows}
    audit = [
        {
            "action": row["action"],
            "actor": row["actor"],
            "createdAt": row["created_at"],
        }
        for row in audit_rows
    ]
    return jsonify(
        {
            "totals": totals,
            "series": {
                "accounts": [
                    {"date": day.isoformat(), "count": account_counts.get(day.isoformat(), 0)}
                    for day in days
                ],
                "messages": [
                    {"date": day.isoformat(), "count": message_counts.get(day.isoformat(), 0)}
                    for day in days
                ],
            },
            "controls": control_state(),
            "announcement": get_announcement(),
            "audit": audit,
        }
    )


@app.get("/api/admin/users")
def admin_list_users():
    _, failure = require_management_user()
    if failure:
        return failure
    with db_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, username, email, role, created_at
            FROM users WHERE deletion_requested_at IS NULL
            ORDER BY created_at DESC LIMIT 1000
            """
        ).fetchall()
    return jsonify(
        {
            "users": [
                {
                    "id": row["id"],
                    "username": row["username"],
                    "email": row["email"],
                    "role": role_for_user(row),
                    "createdAt": row["created_at"],
                }
                for row in rows
            ]
        }
    )


@app.patch("/api/admin/users/<user_id>")
def admin_update_user_role(user_id: str):
    admin, failure = require_management_user(admin_only=True)
    if failure:
        return failure
    data = request.get_json(silent=True) or {}
    role = str(data.get("role", "")).strip().lower()
    allowed_roles = {"user", "soldier", "moraltown", "admin", "co_founder", "og", "fed"}
    if role not in allowed_roles:
        return error_response("Choose a supported account role.", 400)
    with db_connection() as connection:
        connection.execute(
            "UPDATE users SET role = ?, updated_at = ? WHERE id = ? AND deletion_requested_at IS NULL",
            (role, utc_now(), user_id),
        )
        row = connection.execute(
            """
            SELECT id, username, email, role, created_at
            FROM users WHERE id = ? AND deletion_requested_at IS NULL
            """,
            (user_id,),
        ).fetchone()
    if not row:
        return error_response("Account not found.", 404)
    write_admin_audit(
        f"Changed role for {row['username']} to {role}",
        str(admin["username"]),
    )
    return jsonify(
        {
            "user": {
                "id": row["id"],
                "username": row["username"],
                "email": row["email"],
                "role": role_for_user(row),
                "createdAt": row["created_at"],
            }
        }
    )


@app.post("/api/admin/control")
def admin_update_control():
    admin, failure = require_management_user()
    if failure:
        return failure
    data = request.get_json(silent=True) or {}
    key = str(data.get("key", "")).strip()
    enabled = data.get("enabled")
    if not isinstance(enabled, bool):
        return error_response("An enabled boolean is required.", 400)
    setting = {
        "lockdown": ("lockdown", "Mailbox lockdown"),
        "apiPaused": ("api_paused", "API traffic pause"),
        "sendingEnabled": ("sending_enabled", "Outbound mail"),
        "receivingEnabled": ("receiving_enabled", "Inbound mail"),
    }.get(key)
    if not setting:
        return error_response("Choose a supported operating control.", 400)
    setting_key, label = setting
    if key == "lockdown":
        message = str(data.get("message", "")).strip()[:500]
        if enabled and not message:
            message = "WEBSITE SHUT DOWN BY ADMIN | WILL BE BACK SOON"
        write_system_setting("lockdown_message", message)
    write_system_setting(setting_key, "1" if enabled else "0")
    write_admin_audit(
        f"{label} {'enabled' if enabled else 'disabled'}",
        str(admin["username"]),
    )
    return jsonify({"controls": control_state()})


@app.post("/api/admin/announcement")
def admin_update_announcement():
    admin, failure = require_management_user()
    if failure:
        return failure
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip()
    if len(message) > 500:
        return error_response("Announcements are limited to 500 characters.", 400)
    with db_connection() as connection:
        if message:
            connection.execute(
                """
                INSERT INTO site_announcements(id, message, updated_at)
                VALUES (1, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  message = excluded.message, updated_at = excluded.updated_at
                """,
                (message, utc_now()),
            )
        else:
            connection.execute("DELETE FROM site_announcements WHERE id = 1")
    write_admin_audit(
        "Published an announcement" if message else "Cleared the announcement",
        str(admin["username"]),
    )
    return jsonify({"announcement": get_announcement()})


def public_payment_order(order: sqlite3.Row) -> dict[str, Any]:
    currency = order["currency"]
    asset = PAYMENT_ASSETS[currency]
    response: dict[str, Any] = {
        "id": order["id"],
        "currency": currency,
        "address": order["address"],
        "amount": order["amount_text"],
        "usdPrice": "15.00",
        "status": order["status"],
        "confirmations": order["confirmations"],
        "requiredConfirmations": asset["confirmations"],
        "expiresAt": order["expires_at"],
        "transactionId": order["transaction_id"],
        "confirmationEmailSent": bool(
            order["confirmation_email_sent_at"]
        ) if order["contact_email"] else False,
    }
    if (
        order["status"] == "confirmed"
        and order["transaction_id"]
        and not order["claim_token_hash"]
    ):
        # Older confirmed orders keep their existing in-browser claim path.
        response["purchaseToken"] = purchase_proof(
            order["id"], order["transaction_id"], str(app.config["SECRET_KEY"])
        )
    return response


def payment_provider_ready() -> bool:
    configured_secret = os.environ.get("SESSION_SECRET", "").strip()
    return bool(configured_secret and configured_secret != "local-development-session-secret")


@app.post("/api/payments/orders")
def create_payment_order():
    if not payment_provider_ready():
        return error_response("Secure payment checkout is unavailable until the session secret is configured.", 503)
    data = request.get_json(silent=True) or {}
    currency = str(data.get("currency", "")).upper()
    if currency not in PAYMENT_ASSETS:
        return error_response("Choose BTC, SOL, ETH, or LTC.", 400)
    contact_email = str(data.get("email", "")).strip().lower()
    parsed_email = parseaddr(contact_email)[1]
    if (
        len(contact_email) > 254
        or parsed_email != contact_email
        or not re.fullmatch(r"[^@\s]+@[^@\s.]+(?:\.[^@\s.]+)+", contact_email)
    ):
        return error_response("Enter a valid email address for your account link.", 400)

    now = int(time.time())
    last_request = int(session.get("payment_order_requested_at", 0))
    if now - last_request < 8:
        return error_response("Please wait a few seconds before creating another payment request.", 429)
    session["payment_order_requested_at"] = now
    with db_connection() as connection:
        if connection.execute(
            "SELECT 1 FROM users WHERE purchase_email = ? LIMIT 1",
            (contact_email,),
        ).fetchone():
            return error_response(
                "This email already has a paid account. Use an access code to make another account.",
                409,
            )
        existing_order = connection.execute(
            """
            SELECT * FROM payment_orders
            WHERE contact_email = ? AND claimed_at IS NULL
              AND status IN ('pending', 'checking', 'confirming', 'confirmed')
            ORDER BY created_at DESC LIMIT 1
            """,
            (contact_email,),
        ).fetchone()
        if existing_order:
            return jsonify(public_payment_order(existing_order)), 200
    try:
        price = spot_usd(currency)
        base_amount = amount_units_for_usd(currency, Decimal("15.00"), price)
        order_id = new_id()
        claim_token = secrets.token_urlsafe(32)
        claim_token_hash = hashlib.sha256(claim_token.encode("utf-8")).hexdigest()
        claim_token_ciphertext = encrypt_access_key(claim_token)
        expires_at = now + PAYMENT_EXPIRY_SECONDS
        with db_connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            last_used = connection.execute(
                """
                SELECT MAX(derive_index) AS last_index FROM payment_orders
                WHERE currency = ?
                """,
                (currency,),
            ).fetchone()
            last_index = last_used["last_index"]
            derive_index = 0 if last_index is None else int(last_index) + 1

            # Shared ETH/SOL addresses require an exact, per-order amount so a
            # transfer can be associated without a memo or customer identity.
            offset_step = 1_000_000_000 if currency == "ETH" else 1
            amount_units = base_amount
            for offset in range(1, 10_000):
                candidate = base_amount + offset * offset_step
                existing = connection.execute(
                    "SELECT 1 FROM payment_orders WHERE currency = ? AND amount_units = ?",
                    (currency, str(candidate)),
                ).fetchone()
                if existing is None:
                    amount_units = candidate
                    break
            else:
                return error_response("Checkout is busy. Please try again shortly.", 503)

            address, start_height = address_and_start_height(currency, derive_index)
            amount_text = format_units(currency, amount_units)
            connection.execute(
                """
                INSERT INTO payment_orders
                  (id, currency, address, derive_index, amount_units, amount_text,
                   price_usd, start_height, status, created_at, expires_at,
                   contact_email, claim_token_hash, claim_token_ciphertext, claim_origin)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
                """,
                (
                    order_id,
                    currency,
                    address,
                    derive_index if currency in ("BTC", "LTC") else None,
                    str(amount_units),
                    amount_text,
                    str(price),
                    start_height,
                    now,
                    expires_at,
                    contact_email,
                    claim_token_hash,
                    claim_token_ciphertext,
                    request.host_url.rstrip("/"),
                ),
            )
            order = connection.execute(
                "SELECT * FROM payment_orders WHERE id = ?", (order_id,)
            ).fetchone()
    except PaymentProviderError as exc:
        return error_response(str(exc), 503)
    except (InvalidOperation, ValueError, OverflowError):
        return error_response("The payment amount could not be prepared. Please try again.", 503)
    return jsonify(public_payment_order(order)), 201


@app.post("/api/payments/orders/<order_id>/sent")
def mark_payment_sent(order_id: str):
    with db_connection() as connection:
        order = connection.execute(
            "SELECT * FROM payment_orders WHERE id = ?", (order_id,)
        ).fetchone()
        if not order:
            return error_response("Payment request not found.", 404)
        if order["status"] == "pending":
            connection.execute(
                "UPDATE payment_orders SET status = 'checking', last_checked_at = 0 WHERE id = ?",
                (order_id,),
            )
    refreshed = refresh_payment_order(order_id)
    return jsonify(public_payment_order(refreshed))


def attempt_payment_confirmation_email(order_id: str) -> None:
    now = int(time.time())
    with db_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        order = connection.execute(
            "SELECT * FROM payment_orders WHERE id = ?", (order_id,)
        ).fetchone()
        if (
            not order
            or order["status"] != "confirmed"
            or not order["contact_email"]
            or order["confirmation_email_sent_at"]
            or now - int(order["confirmation_email_attempted_at"] or 0)
            < PAYMENT_EMAIL_RETRY_SECONDS
        ):
            return
        connection.execute(
            """
            UPDATE payment_orders SET confirmation_email_attempted_at = ?
            WHERE id = ? AND confirmation_email_sent_at IS NULL
            """,
            (now, order_id),
        )
        claim_token = decrypt_access_key(order["claim_token_ciphertext"] or "")
        recipient = str(order["contact_email"])
        origin = str(order["claim_origin"] or "").rstrip("/")
    if not claim_token or not origin:
        logging.getLogger("moraltown.payment").error(
            "Cannot prepare the confirmation link for payment order %s.", order_id
        )
        return
    claim_url = f"{origin}/claim?token={quote(claim_token, safe='')}"
    try:
        send_resend_payment_confirmation(recipient, claim_url, order_id)
    except PaymentConfirmationEmailError:
        logging.getLogger("moraltown.payment").warning(
            "Confirmation email delivery failed for payment order %s.", order_id
        )
        return
    with db_connection() as connection:
        connection.execute(
            """
            UPDATE payment_orders SET confirmation_email_sent_at = ?
            WHERE id = ? AND confirmation_email_sent_at IS NULL
            """,
            (int(time.time()), order_id),
        )


def refresh_payment_order(order_id: str) -> sqlite3.Row | None:
    now = int(time.time())
    with db_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        order = connection.execute(
            "SELECT * FROM payment_orders WHERE id = ?", (order_id,)
        ).fetchone()
        if not order:
            return None
        if order["status"] == "confirmed":
            pass
        elif order["status"] != "expired":
            if now - int(order["last_checked_at"]) < PAYMENT_CHECK_INTERVAL_SECONDS:
                return order
            reserved = connection.execute(
                """
                UPDATE payment_orders SET last_checked_at = ?
                WHERE id = ? AND status IN ('pending', 'checking', 'confirming')
                  AND last_checked_at <= ?
                """,
                (now, order_id, now - PAYMENT_CHECK_INTERVAL_SECONDS),
            )
            if reserved.rowcount != 1:
                return connection.execute(
                    "SELECT * FROM payment_orders WHERE id = ?", (order_id,)
                ).fetchone()
            order = connection.execute(
                "SELECT * FROM payment_orders WHERE id = ?", (order_id,)
            ).fetchone()
        else:
            return order

    if order["status"] == "confirmed":
        attempt_payment_confirmation_email(order_id)
        with db_connection() as connection:
            return connection.execute(
                "SELECT * FROM payment_orders WHERE id = ?", (order_id,)
            ).fetchone()

    try:
        match = find_payment(
            order["currency"],
            order["address"],
            int(order["amount_units"]),
            int(order["start_height"]),
        )
    except (PaymentProviderError, ValueError, TypeError, KeyError, OverflowError):
        logging.getLogger("moraltown.payment").warning(
            "Blockchain lookup failed for payment order %s.", order_id
        )
        with db_connection() as connection:
            return connection.execute(
                "SELECT * FROM payment_orders WHERE id = ?", (order_id,)
            ).fetchone()

    now = int(time.time())
    with db_connection() as connection:
        current = connection.execute(
            "SELECT * FROM payment_orders WHERE id = ?", (order_id,)
        ).fetchone()
        if not current:
            return None
        if current["status"] == "confirmed":
            order = current
        elif match and match.get("txid"):
            required = PAYMENT_ASSETS[current["currency"]]["confirmations"]
            next_status = (
                "confirmed"
                if int(match["confirmations"]) >= required
                else "confirming"
            )
            connection.execute(
                """
                UPDATE payment_orders
                SET status = ?, transaction_id = ?, confirmations = ?,
                    received_units = ?
                WHERE id = ? AND status IN ('pending', 'checking', 'confirming')
                """,
                (
                    next_status,
                    match["txid"],
                    int(match["confirmations"]),
                    current["amount_units"],
                    order_id,
                ),
            )
        elif now >= int(current["expires_at"]):
            connection.execute(
                """
                UPDATE payment_orders SET status = 'expired',
                    transaction_id = NULL, confirmations = 0, received_units = '0'
                WHERE id = ? AND status IN ('pending', 'checking', 'confirming')
                """,
                (order_id,),
            )
        elif current["status"] == "confirming":
            # A chain reorganization invalidates an earlier, shallow match.
            connection.execute(
                """
                UPDATE payment_orders SET status = 'pending', transaction_id = NULL,
                    confirmations = 0, received_units = '0'
                WHERE id = ? AND status = 'confirming'
                """,
                (order_id,),
            )
        order = connection.execute(
            "SELECT * FROM payment_orders WHERE id = ?", (order_id,)
        ).fetchone()
    if order and order["status"] == "confirmed":
        attempt_payment_confirmation_email(order_id)
        with db_connection() as connection:
            order = connection.execute(
                "SELECT * FROM payment_orders WHERE id = ?", (order_id,)
            ).fetchone()
    return order


@app.get("/api/payments/orders/<order_id>")
def get_payment_order(order_id: str):
    order = refresh_payment_order(order_id)
    if not order:
        return error_response("Payment request not found.", 404)
    return jsonify(public_payment_order(order))


@app.get("/api/payments/claims/validate")
def validate_payment_claim():
    token = str(request.args.get("token", "")).strip()
    if len(token) > 128:
        return jsonify({"valid": False})
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with db_connection() as connection:
        order = connection.execute(
            """
            SELECT status, claimed_at, claim_token_hash
            FROM payment_orders WHERE claim_token_hash = ?
            """,
            (token_hash,),
        ).fetchone()
    valid = bool(
        token
        and order
        and order["status"] == "confirmed"
        and order["claimed_at"] is None
        and hmac.compare_digest(str(order["claim_token_hash"]), token_hash)
    )
    return jsonify({"valid": valid})


def scan_payment_orders_once() -> None:
    now = int(time.time())
    with db_connection() as connection:
        due_orders = connection.execute(
            """
            SELECT id FROM payment_orders
            WHERE status IN ('pending', 'checking', 'confirming')
              AND last_checked_at <= ?
            ORDER BY created_at ASC LIMIT 20
            """,
            (now - PAYMENT_CHECK_INTERVAL_SECONDS,),
        ).fetchall()
        email_orders = connection.execute(
            """
            SELECT id FROM payment_orders
            WHERE status = 'confirmed' AND contact_email IS NOT NULL
              AND confirmation_email_sent_at IS NULL
              AND confirmation_email_attempted_at <= ?
            ORDER BY created_at ASC LIMIT 20
            """,
            (now - PAYMENT_EMAIL_RETRY_SECONDS,),
        ).fetchall()
    for row in due_orders:
        refresh_payment_order(row["id"])
    for row in email_orders:
        attempt_payment_confirmation_email(row["id"])


def payment_monitor_loop() -> None:
    while True:
        try:
            scan_payment_orders_once()
        except (sqlite3.Error, OSError):
            logging.getLogger("moraltown.payment").exception(
                "The automatic payment monitor encountered an error."
            )
        time.sleep(PAYMENT_MONITOR_INTERVAL_SECONDS)


def run_database_singleton(service_name: str, target) -> None:
    """Run one shared-database background service across local/Gunicorn processes."""
    lock_path = DATABASE_PATH.with_name(f".{DATABASE_PATH.name}.{service_name}.lock")
    while True:
        try:
            with lock_path.open("a") as lock_file:
                try:
                    fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    time.sleep(2)
                    continue
                target()
        except Exception:
            logging.getLogger(f"moraltown.{service_name}").exception(
                "A shared-database background service stopped unexpectedly."
            )
            time.sleep(2)


_payment_monitor_started = False
_payment_monitor_start_lock = threading.Lock()


def start_payment_monitor() -> None:
    global _payment_monitor_started
    with _payment_monitor_start_lock:
        if _payment_monitor_started:
            return
        monitor = threading.Thread(
            target=run_database_singleton,
            args=("payment-monitor", payment_monitor_loop),
            daemon=True,
            name="moraltown-payment-monitor",
        )
        monitor.start()
        _payment_monitor_started = True


def process_due_account_deletions(now: int | None = None) -> int:
    """Scrub due accounts and remove their temporary tombstones."""
    timestamp = int(time.time()) if now is None else int(now)
    processed = 0
    while True:
        with db_connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            job = connection.execute(
                """
                SELECT id, user_id, completes_at
                FROM account_deletion_jobs
                WHERE next_check_at <= ?
                ORDER BY started_at
                LIMIT 1
                """,
                (timestamp,),
            ).fetchone()
            if not job:
                break

            user_id = job["user_id"]
            # Repeat the account-scoped sweep while the job is active; foreign
            # key cascades provide a final safety net when the tombstone drops.
            for table in ("messages", "folders", "notifications", "subscriptions"):
                connection.execute(
                    f"DELETE FROM {table} WHERE user_id = ?", (user_id,)
                )

            if timestamp >= int(job["completes_at"]):
                connection.execute(
                    "DELETE FROM users WHERE id = ? AND deletion_requested_at IS NOT NULL",
                    (user_id,),
                )
                connection.execute(
                    "DELETE FROM account_deletion_jobs WHERE id = ?", (job["id"],)
                )
            else:
                connection.execute(
                    """
                    UPDATE account_deletion_jobs
                    SET next_check_at = ?, checks_done = checks_done + 1
                    WHERE id = ?
                    """,
                    (
                        min(timestamp + 30, int(job["completes_at"])),
                        job["id"],
                    ),
                )
            processed += 1
    return processed


def account_deletion_loop() -> None:
    while True:
        try:
            process_due_account_deletions()
        except sqlite3.Error:
            logging.getLogger("moraltown.account_deletion").exception(
                "The account deletion worker encountered a database error."
            )
        time.sleep(1)


_account_deletion_worker_started = False
_account_deletion_worker_lock = threading.Lock()


def start_account_deletion_worker() -> None:
    global _account_deletion_worker_started
    with _account_deletion_worker_lock:
        if _account_deletion_worker_started:
            return
        worker = threading.Thread(
            target=run_database_singleton,
            args=("account-deletion", account_deletion_loop),
            daemon=True,
            name="moraltown-account-deletion",
        )
        worker.start()
        _account_deletion_worker_started = True


@app.post("/api/auth/signup")
def signup():
    data = request.get_json(silent=True) or {}
    if not consume_captcha(data):
        return error_response("Complete the human check and try again.", 400)
    access_key = str(data.get("accessKey", "")).strip()
    username = normalize_username(str(data.get("username", "")))
    if not valid_access_key(access_key) or not valid_username(username):
        return error_response(
            "Use a 50-digit access key and a username with at least one letter.",
            400,
        )
    access_code = str(data.get("accessCode", "")).strip()
    purchase_token = str(data.get("purchaseToken", "")).strip()
    claim_token = str(data.get("claimToken", "")).strip()
    free_access = bool(access_code) and accepts_free_access_code(access_code)
    purchase_order_id = purchase_token.split(".", 1)[0] if "." in purchase_token else ""
    claim_token_hash = hashlib.sha256(claim_token.encode("utf-8")).hexdigest()
    if not free_access and not (claim_token or purchase_order_id):
        return error_response("Enter a valid access code or complete the lifetime purchase.", 402)

    now = utc_now()
    user = {
        "id": new_id(),
        "access_key_hash": hash_access_key(access_key),
        "access_key_ciphertext": encrypt_access_key(access_key),
        "access_key_lookup_hash": hash_access_key_lookup(access_key),
        "username": username,
        "email": mailbox_address(username),
        "purchase_email": None,
        "email_changes_remaining": 2,
        "email_change_year": datetime.now(timezone.utc).year,
        "created_at": now,
        "updated_at": now,
    }
    try:
        with db_connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            order_id_to_claim = None
            if not free_access:
                if claim_token:
                    order = connection.execute(
                        "SELECT * FROM payment_orders WHERE claim_token_hash = ?",
                        (claim_token_hash,),
                    ).fetchone()
                    if (
                        not order
                        or order["status"] != "confirmed"
                        or order["claimed_at"] is not None
                        or not order["contact_email"]
                        or not hmac.compare_digest(
                            str(order["claim_token_hash"]), claim_token_hash
                        )
                    ):
                        return error_response(
                            "This account claim link is invalid or has already been used.",
                            402,
                        )
                    if connection.execute(
                        "SELECT 1 FROM users WHERE purchase_email = ? LIMIT 1",
                        (order["contact_email"],),
                    ).fetchone():
                        return error_response(
                            "This email already has a paid account. Use an access code to make another account.",
                            409,
                        )
                    user["purchase_email"] = order["contact_email"]
                    order_id_to_claim = order["id"]
                else:
                    order = connection.execute(
                        "SELECT * FROM payment_orders WHERE id = ?",
                        (purchase_order_id,),
                    ).fetchone()
                    if (
                        not order
                        or order["status"] != "confirmed"
                        or not order["transaction_id"]
                        or order["claimed_at"] is not None
                        or not valid_purchase_proof(
                            purchase_token,
                            purchase_order_id,
                            order["transaction_id"],
                            str(app.config["SECRET_KEY"]),
                        )
                    ):
                        return error_response(
                            "This confirmed payment cannot be used for account creation.",
                            402,
                        )
                    order_id_to_claim = order["id"]
            connection.execute(
                """
                INSERT INTO users
                   (id, access_key_hash, access_key_ciphertext, access_key_lookup_hash,
                    username, email, role, purchase_email, email_changes_remaining,
                   email_change_year, created_at, updated_at)
                VALUES (:id, :access_key_hash, :access_key_ciphertext, :access_key_lookup_hash,
                        :username, :email, 'user', :purchase_email, :email_changes_remaining,
                        :email_change_year, :created_at, :updated_at)
                """,
                user,
            )
            for name in ("inbox", "sent", "drafts", "spam"):
                connection.execute(
                    "INSERT INTO folders (id, user_id, name, created_at) VALUES (?, ?, ?, ?)",
                    (new_id(), user["id"], name, now),
                )
            connection.execute(
                """
                INSERT INTO messages
                  (id, user_id, folder, sender, recipient, subject, body,
                   content_encrypted, received_at, is_read)
                VALUES (?, ?, 'inbox', ?, ?, ?, ?, 1, ?, 0)
                """,
                (
                    new_id(),
                    user["id"],
                    encrypt_mailbox_text(f"hello@{MAIL_DOMAIN}"),
                    encrypt_mailbox_text(user["email"]),
                    encrypt_mailbox_text("Welcome to MoralTown"),
                    encrypt_mailbox_text(
                        "Your private inbox is ready. Send your first message from the compose button."
                    ),
                    now,
                ),
            )
            if order_id_to_claim:
                connection.execute(
                    "UPDATE payment_orders SET claimed_at = ? WHERE id = ? AND claimed_at IS NULL",
                    (int(time.time()), order_id_to_claim),
                )
    except sqlite3.IntegrityError:
        return error_response(
            "That access key, username, or paid email is already in use.", 409
        )
    session.clear()
    session.permanent = True
    session["user_id"] = user["id"]
    return jsonify({"user": public_user(user), "firstLogin": True}), 201


@app.post("/api/auth/signin")
def signin():
    data = request.get_json(silent=True) or {}
    if not consume_captcha(data):
        return error_response("Complete the human check and try again.", 400)
    access_key = str(data.get("accessKey", "")).strip()
    if not valid_access_key(access_key):
        return error_response("Access key rejected.", 401)
    if is_admin_login_key(access_key):
        session.clear()
        session.permanent = True
        session["admin_authenticated"] = True
        return jsonify({"user": public_user(admin_account()), "firstLogin": False})
    lookup_hash = hash_access_key_lookup(access_key)
    with db_connection() as connection:
        matching = connection.execute(
            """
            SELECT * FROM users
            WHERE access_key_lookup_hash = ? AND deletion_requested_at IS NULL
            """,
            (lookup_hash,),
        ).fetchone()
        if not matching:
            legacy = connection.execute(
                """
                SELECT * FROM users
                WHERE access_key_lookup_hash IS NULL AND deletion_requested_at IS NULL
                LIMIT 100
                """
            ).fetchall()
            matching = next(
                (
                    row for row in legacy
                    if check_access_key(access_key, row["access_key_hash"])
                ),
                None,
            )
    if matching and not check_access_key(access_key, matching["access_key_hash"]):
        matching = None
    if not matching:
        return error_response("Access key rejected.", 401)
    session.clear()
    session.permanent = True
    session["user_id"] = matching["id"]
    return jsonify({"user": public_user(matching), "firstLogin": False})


@app.get("/api/auth/access-key")
def get_access_key():
    try:
        user = require_user()
    except PermissionError as exc:
        return error_response(str(exc), 401)
    access_key = decrypt_access_key(user["access_key_ciphertext"] or "")
    if not access_key:
        return error_response("This legacy account needs a key refresh before it can be revealed.", 409)
    return jsonify({"accessKey": access_key})


@app.post("/api/auth/rotate-key")
def rotate_access_key():
    try:
        user = require_user()
    except PermissionError as exc:
        return error_response(str(exc), 401)
    access_key = generate_access_key()
    with db_connection() as connection:
        connection.execute(
            """
            UPDATE users
            SET access_key_hash = ?, access_key_ciphertext = ?,
                access_key_lookup_hash = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                hash_access_key(access_key),
                encrypt_access_key(access_key),
                hash_access_key_lookup(access_key),
                utc_now(),
                user["id"],
            ),
        )
    return jsonify({"accessKey": access_key, "rotatedAt": utc_now()})


@app.post("/api/auth/signout")
def signout():
    session.clear()
    return ("", 204)


@app.post("/api/account/deletion")
def request_account_deletion():
    origin = request.headers.get("Origin", "")
    parsed_origin = urlsplit(origin)
    allowed_schemes = {"http", "https"} if not IS_PRODUCTION else {"https"}
    if (
        not parsed_origin.netloc
        or parsed_origin.netloc.lower() != request.host.lower()
        or parsed_origin.scheme not in allowed_schemes
    ):
        return error_response("A same-origin request is required.", 403)

    user = current_user()
    if not user:
        return error_response("Sign in required.", 401)

    body = request.get_json(silent=True)
    access_key = str(body.get("accessKey", "") if isinstance(body, dict) else "").strip()
    if not valid_access_key(access_key) or not check_access_key(
        access_key, user["access_key_hash"]
    ):
        return error_response(
            "The current access key is required to delete this account.", 403
        )

    now = int(time.time())
    deletion_token = secrets.token_urlsafe(32)
    deletion_id = new_id()
    tombstone_username = f"deleted-{new_id()}"
    tombstone_email = f"{tombstone_username}@invalid.invalid"

    with db_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        current = connection.execute(
            "SELECT * FROM users WHERE id = ? AND deletion_requested_at IS NULL",
            (user["id"],),
        ).fetchone()
        if not current:
            return error_response("This account is already being deleted.", 409)

        private_emails = sorted(
            {
                value.strip()
                for value in (current["email"], current["purchase_email"])
                if value and value.strip()
            }
        )
        for table in ("messages", "folders", "notifications", "subscriptions"):
            connection.execute(
                f"DELETE FROM {table} WHERE user_id = ?", (current["id"],)
            )

        if private_emails:
            placeholders = ",".join("?" for _ in private_emails)
            connection.execute(
                f"""
                UPDATE payment_orders
                SET contact_email = NULL,
                    claim_token_hash = NULL,
                    claim_token_ciphertext = NULL,
                    claim_origin = NULL,
                    confirmation_email_sent_at = NULL,
                    confirmation_email_attempted_at = 0
                WHERE contact_email IN ({placeholders})
                """,
                private_emails,
            )

        connection.execute(
            """
            UPDATE users
            SET access_key_hash = ?, access_key_ciphertext = NULL,
                username = ?, email = ?, purchase_email = NULL,
                email_changes_remaining = 0, deletion_requested_at = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                f"revoked${new_id()}",
                tombstone_username,
                tombstone_email,
                now,
                utc_now(),
                current["id"],
            ),
        )
        connection.execute(
            """
            INSERT INTO account_deletion_jobs
              (id, user_id, token_hash, started_at, completes_at,
               next_check_at, checks_done)
            VALUES (?, ?, ?, ?, ?, ?, 0)
            """,
            (
                deletion_id,
                current["id"],
                hashlib.sha256(deletion_token.encode("utf-8")).hexdigest(),
                now,
                now + ACCOUNT_DELETION_SECONDS,
                min(now + 30, now + ACCOUNT_DELETION_SECONDS),
            ),
        )

    session.clear()
    response = jsonify(
        {
            "status": "running",
            "deletionToken": deletion_token,
            "startedAt": now,
            "completesAt": now + ACCOUNT_DELETION_SECONDS,
            "durationSeconds": ACCOUNT_DELETION_SECONDS,
        }
    )
    response.status_code = 202
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return response


@app.get("/api/account/deletion/status")
def account_deletion_status():
    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        return error_response("Deletion status token required.", 401)
    token = authorization.removeprefix("Bearer ").strip()
    if len(token) < 32:
        return error_response("Deletion status token rejected.", 401)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    with db_connection() as connection:
        job = connection.execute(
            """
            SELECT started_at, completes_at, checks_done
            FROM account_deletion_jobs WHERE token_hash = ?
            """,
            (token_hash,),
        ).fetchone()
    if not job:
        response = jsonify(
            {"status": "complete", "remainingSeconds": 0, "checksDone": 0}
        )
        response.headers["Cache-Control"] = "no-store, max-age=0"
        return response

    now = int(time.time())
    response = jsonify(
        {
            "status": "running",
            "startedAt": int(job["started_at"]),
            "completesAt": int(job["completes_at"]),
            "remainingSeconds": max(0, int(job["completes_at"]) - now),
            "checksDone": int(job["checks_done"]),
        }
    )
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return response


@app.get("/api/auth/me")
def auth_me():
    user = current_user()
    return jsonify(public_user(user)) if user else error_response("Sign in required", 401)


@app.patch("/api/auth/profile")
def update_profile():
    try:
        user = require_user()
    except PermissionError as exc:
        return error_response(str(exc), 401)
    username = normalize_username(str((request.get_json(silent=True) or {}).get("username", "")))
    if not valid_username(username):
        return error_response("Username must include at least one letter.", 400)
    year = datetime.now(timezone.utc).year
    remaining = user["email_changes_remaining"] if user["email_change_year"] == year else 2
    changing = username != user["username"]
    if changing and remaining <= 0:
        return error_response("You have used both email address changes for this year.", 400)
    try:
        with db_connection() as connection:
            connection.execute(
                """
                UPDATE users SET username = ?, email = ?, email_changes_remaining = ?,
                  email_change_year = ?, updated_at = ? WHERE id = ?
                """,
                (
                    username,
                    mailbox_address(username),
                    remaining - 1 if changing else remaining,
                    year,
                    utc_now(),
                    user["id"],
                ),
            )
            updated = connection.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    except sqlite3.IntegrityError:
        return error_response("That username is already in use.", 409)
    return jsonify(public_user(updated))


@app.get("/api/mailbox/summary")
def mailbox_summary():
    try:
        user = require_user()
    except PermissionError as exc:
        return error_response(str(exc), 401)
    with db_connection() as connection:
        rows = connection.execute(
            "SELECT folder, COUNT(*) AS total FROM messages WHERE user_id = ? GROUP BY folder",
            (user["id"],),
        ).fetchall()
        unread = connection.execute(
            "SELECT COUNT(*) FROM messages WHERE user_id = ? AND is_read = 0", (user["id"],)
        ).fetchone()[0]
        folders = connection.execute(
            "SELECT COUNT(*) FROM folders WHERE user_id = ?", (user["id"],)
        ).fetchone()[0]
        notifications = connection.execute(
            "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0",
            (user["id"],),
        ).fetchone()[0]
    counts = {row["folder"]: row["total"] for row in rows}
    return jsonify(
        {
            "unread": unread,
            "inbox": counts.get("inbox", 0),
            "sent": counts.get("sent", 0),
            "spam": counts.get("spam", 0),
            "drafts": counts.get("drafts", 0),
            "folders": folders,
            "notifications": notifications,
        }
    )


@app.get("/api/messages")
def list_messages():
    try:
        user = require_user()
    except PermissionError as exc:
        return error_response(str(exc), 401)
    folder = request.args.get("folder", "inbox")
    query = request.args.get("q", "").strip().lower()
    with db_connection() as connection:
        rows = connection.execute(
            """
            SELECT * FROM messages
            WHERE user_id = ? AND (? = 'starred' AND is_starred = 1 OR ? != 'starred' AND folder = ?)
            ORDER BY received_at DESC
            """,
            (user["id"], folder, folder, folder),
        ).fetchall()
    messages = [public_message(row) for row in rows]
    if query:
        messages = [
            message
            for message in messages
            if query in " ".join(
                [message["from"], message["to"], message["subject"], message["body"]]
            ).lower()
        ]
    return jsonify(messages)


@app.get("/api/messages/<message_id>")
def get_message(message_id: str):
    try:
        user = require_user()
    except PermissionError as exc:
        return error_response(str(exc), 401)
    with db_connection() as connection:
        row = connection.execute(
            "SELECT * FROM messages WHERE id = ? AND user_id = ?", (message_id, user["id"])
        ).fetchone()
        if not row:
            return error_response("Message not found", 404)
        connection.execute("UPDATE messages SET is_read = 1 WHERE id = ?", (message_id,))
        row = dict(row)
        row["is_read"] = 1
    return jsonify(public_message(row))


@app.patch("/api/messages/<message_id>")
def update_message(message_id: str):
    try:
        user = require_user()
    except PermissionError as exc:
        return error_response(str(exc), 401)
    data = request.get_json(silent=True) or {}
    fields = {key: data[key] for key in ("folder", "isRead", "isStarred") if key in data}
    assignments = []
    values: list[Any] = []
    for key, value in fields.items():
        column = {"isRead": "is_read", "isStarred": "is_starred"}.get(key, key)
        if column == "folder" and not isinstance(value, str):
            return error_response("Invalid message update.", 400)
        assignments.append(f"{column} = ?")
        values.append(int(value) if column != "folder" else value)
    if not assignments:
        return error_response("Invalid message update.", 400)
    values.extend([message_id, user["id"]])
    with db_connection() as connection:
        connection.execute(
            f"UPDATE messages SET {', '.join(assignments)} WHERE id = ? AND user_id = ?",
            values,
        )
        row = connection.execute(
            "SELECT * FROM messages WHERE id = ? AND user_id = ?", (message_id, user["id"])
        ).fetchone()
    return jsonify(public_message(row)) if row else error_response("Message not found", 404)


app.post("/api/send")(handle_send)
app.post("/api/messages")(handle_send)


@app.get("/api/folders")
def list_folders():
    try:
        user = require_user()
    except PermissionError as exc:
        return error_response(str(exc), 401)
    with db_connection() as connection:
        rows = connection.execute(
            """
            SELECT f.id, f.name, COUNT(m.id) AS count
            FROM folders f LEFT JOIN messages m ON m.folder = f.name AND m.user_id = f.user_id
            WHERE f.user_id = ? GROUP BY f.id ORDER BY f.created_at
            """,
            (user["id"],),
        ).fetchall()
    return jsonify([{"id": row["id"], "name": row["name"], "count": row["count"]} for row in rows])


@app.post("/api/folders")
def create_folder():
    try:
        user = require_user()
    except PermissionError as exc:
        return error_response(str(exc), 401)
    name = normalize_username(str((request.get_json(silent=True) or {}).get("name", ""))).replace(".", "-")
    if not name:
        return error_response("Folder name is required.", 400)
    folder_id = new_id()
    try:
        with db_connection() as connection:
            connection.execute(
                "INSERT INTO folders (id, user_id, name, created_at) VALUES (?, ?, ?, ?)",
                (folder_id, user["id"], name, utc_now()),
            )
    except sqlite3.IntegrityError:
        return error_response("That folder already exists.", 409)
    return jsonify({"id": folder_id, "name": name, "count": 0}), 201


@app.get("/api/notifications")
def list_notifications():
    try:
        user = require_user()
    except PermissionError as exc:
        return error_response(str(exc), 401)
    with db_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, kind, title, message, created_at, is_read FROM notifications
            WHERE user_id = ? ORDER BY created_at DESC LIMIT 30
            """,
            (user["id"],),
        ).fetchall()
    return jsonify(
        [
            {
                "id": row["id"],
                "kind": row["kind"],
                "title": row["title"],
                "message": row["message"],
                "createdAt": row["created_at"],
                "isRead": bool(row["is_read"]),
            }
            for row in rows
        ]
    )


@app.post("/api/notifications/<notification_id>/read")
def mark_notification_read(notification_id: str):
    try:
        user = require_user()
    except PermissionError as exc:
        return error_response(str(exc), 401)
    with db_connection() as connection:
        connection.execute(
            "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
            (notification_id, user["id"]),
        )
    return ("", 204)


@app.get("/api/subscriptions")
def list_subscriptions():
    try:
        user = require_user()
    except PermissionError as exc:
        return error_response(str(exc), 401)
    with db_connection() as connection:
        rows = connection.execute(
            "SELECT id, email, label, active FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC",
            (user["id"],),
        ).fetchall()
    return jsonify(
        [
            {"id": row["id"], "email": row["email"], "label": row["label"], "active": bool(row["active"])}
            for row in rows
        ]
    )


@app.post("/api/subscriptions")
def create_subscription():
    try:
        user = require_user()
    except PermissionError as exc:
        return error_response(str(exc), 401)
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip()
    label = str(data.get("label", "")).strip()
    if not email or not label:
        return error_response("Email and label are required.", 400)
    subscription = (new_id(), user["id"], email, label, utc_now())
    with db_connection() as connection:
        connection.execute(
            """
            INSERT INTO subscriptions (id, user_id, email, label, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            subscription,
        )
    return jsonify({"id": subscription[0], "email": email, "label": label, "active": True}), 201


@app.post("/webhook/mailgun")
@app.post("/api/webhook/mailgun")
@app.post("/webhook/inbound")
@app.post("/api/webhook/inbound")
def mailgun_webhook():
    payload = request.form.to_dict(flat=True)
    if not payload:
        payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return error_response("Expected a Mailgun form or JSON payload.", 400)
    try:
        sender, recipient, subject, body = handle_mailgun_inbound(payload)
    except MailConfigurationError as exc:
        return error_response(str(exc), 503)
    except MailgunReceivingError as exc:
        return error_response(str(exc), 401)
    stored = store_inbound(sender, recipient, subject, body)
    return jsonify({"accepted": True, "stored": stored}), 202


@app.errorhandler(PermissionError)
def handle_permission_error(error: PermissionError):
    return error_response(str(error), 401)


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def frontend(path: str):
    if path.startswith("api/") or path in {"webhook/inbound", "webhook/mailgun"}:
        return error_response("Not found", 404)
    if STATIC_DIR.exists():
        requested = STATIC_DIR / path
        if path and requested.is_file():
            return send_from_directory(STATIC_DIR, path)
        return send_from_directory(STATIC_DIR, "index.html")
    return (
        "<h1>MoralTown</h1><p>Build the web app before starting the production server.</p>",
        503,
    )


init_db()

if __name__ == "__main__":
    start_payment_monitor()
    start_account_deletion_worker()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))