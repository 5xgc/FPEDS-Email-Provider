"""Self-hosted FPEDS webmail service.

Brevo handles outbound transactional messages and Mailgun handles inbound
message routing. Groq is optional for spam scoring.
"""

from __future__ import annotations

import hashlib
import hmac
import html
import os
import re
import secrets
import sqlite3
from datetime import datetime, timezone
from email.utils import parseaddr
from pathlib import Path
from typing import Any
from urllib import error as urlerror
from urllib import request as urlrequest
import json

from flask import Flask, jsonify, request, send_from_directory, session


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

app = Flask(
    __name__,
    static_folder=str(STATIC_DIR) if STATIC_DIR.exists() else None,
)
app.config.update(
    SECRET_KEY=os.environ.get("SESSION_SECRET", "local-development-session-secret"),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=(
        os.environ.get("FLASK_ENV") == "production"
        or os.environ.get("RENDER", "").lower() == "true"
    ),
)


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
              username TEXT NOT NULL UNIQUE,
              email TEXT NOT NULL UNIQUE,
              email_changes_remaining INTEGER NOT NULL DEFAULT 2,
              email_change_year INTEGER NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              folder TEXT NOT NULL DEFAULT 'inbox',
              sender TEXT NOT NULL,
              recipient TEXT NOT NULL,
              subject TEXT NOT NULL,
              body TEXT NOT NULL,
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
            """
        )
        # Keep existing accounts aligned when the mailbox domain is changed
        # from the original FPEDS domain to the configured receiving domain.
        for row in connection.execute("SELECT id, username, email FROM users").fetchall():
            expected_email = mailbox_address(row["username"])
            if row["email"] != expected_email:
                connection.execute(
                    "UPDATE users SET email = ?, updated_at = ? WHERE id = ?",
                    (expected_email, utc_now(), row["id"]),
                )


def new_id() -> str:
    return secrets.token_urlsafe(18)


def hash_access_key(access_key: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", access_key.encode(), salt, 210_000)
    return f"pbkdf2_sha256$210000${salt.hex()}${digest.hex()}"


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


def normalize_username(username: str) -> str:
    return re.sub(r"[^a-z0-9._-]", "", username.strip().lower())


def valid_username(username: str) -> bool:
    return bool(1 <= len(username) <= 40 and re.search(r"[a-z]", username, re.I))


def valid_access_key(access_key: str) -> bool:
    return bool(re.fullmatch(r"\d{50}", access_key.strip()))


def mailbox_address(username: str) -> str:
    return f"{username}@{MAIL_DOMAIN}"


def public_user(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "createdAt": row["created_at"],
        "emailChangesRemaining": row["email_changes_remaining"],
    }


def public_message(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    body = row["body"]
    return {
        "id": row["id"],
        "folder": row["folder"],
        "from": row["sender"],
        "to": row["recipient"],
        "subject": row["subject"],
        "preview": re.sub(r"\s+", " ", body)[:140],
        "body": body,
        "receivedAt": row["received_at"],
        "isRead": bool(row["is_read"]),
        "isStarred": bool(row["is_starred"]),
        "spamScore": row["spam_score"],
        "blocked": bool(row["blocked"]),
    }


def current_user() -> sqlite3.Row | None:
    user_id = session.get("user_id")
    if not user_id:
        return None
    with db_connection() as connection:
        return connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


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
              (id, user_id, folder, sender, recipient, subject, body, received_at, spam_score, blocked)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id(),
                owner["id"],
                "spam" if blocked else "inbox",
                sender,
                recipient,
                subject,
                body,
                utc_now(),
                spam_score,
                int(blocked),
            ),
        )
    if blocked:
        add_notification(
            owner["id"],
            "Spam email blocked",
            f"A message from {sender} was moved to Spam by FPEDS protection.",
            "spam",
        )
    return True


class MailConfigurationError(RuntimeError):
    """The service is missing a required mail setting."""


class BrevoDeliveryError(RuntimeError):
    """Brevo rejected or could not accept an outbound message."""


def send_brevo_message(
    user: sqlite3.Row, recipient: str, subject: str, body: str
) -> None:
    api_key = os.environ.get("BREVO_API_KEY", "").strip()
    if not api_key:
        raise MailConfigurationError(
            "Brevo is not configured. Add BREVO_API_KEY in Render."
        )

    sender_email = (
        os.environ.get("BREVO_SENDER_EMAIL", "").strip() or user["email"]
    )
    sender_name = os.environ.get("BREVO_SENDER_NAME", "FPEDS").strip() or "FPEDS"
    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "replyTo": {"name": user["username"], "email": user["email"]},
        "to": [{"email": recipient}],
        "subject": subject,
        "textContent": body,
    }
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
                "Brevo rejected the API key. Check BREVO_API_KEY in Render."
            ) from exc
        if 400 <= exc.code < 500:
            raise BrevoDeliveryError(
                "Brevo rejected the message. Verify the sender domain and recipient."
            ) from exc
        raise BrevoDeliveryError(
            "Brevo could not deliver the message right now."
        ) from exc
    except (urlerror.URLError, TimeoutError, OSError) as exc:
        raise BrevoDeliveryError(
            "Brevo could not be reached. Check the Render service network and try again."
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
        app.logger.exception("Brevo delivery failed")
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


@app.before_request
def ensure_database() -> None:
    init_db()


@app.get("/api/healthz")
def health():
    sender_email = os.environ.get("BREVO_SENDER_EMAIL", "").strip()
    sender_domain = sender_email.rsplit("@", 1)[-1].lower() if "@" in sender_email else ""
    return jsonify(
        {
            "status": "ok",
            "mailDomain": MAIL_DOMAIN,
            "mailProvider": "brevo",
            "receivingProvider": "mailgun",
            "brevoConfigured": bool(os.environ.get("BREVO_API_KEY", "").strip()),
            "brevoSenderDomain": sender_domain or None,
            "mailgunDomain": os.environ.get("MAILGUN_DOMAIN", MAIL_DOMAIN),
            "mailgunReceivingConfigured": bool(
                os.environ.get("MAILGUN_SIGNING_KEY", "").strip()
            ),
        }
    )


@app.post("/api/auth/signup")
def signup():
    data = request.get_json(silent=True) or {}
    access_key = str(data.get("accessKey", "")).strip()
    username = normalize_username(str(data.get("username", "")))
    if not valid_access_key(access_key) or not valid_username(username):
        return error_response(
            "Use a 50-digit access key and a username with at least one letter.",
            400,
        )
    now = utc_now()
    user = {
        "id": new_id(),
        "access_key_hash": hash_access_key(access_key),
        "username": username,
        "email": mailbox_address(username),
        "email_changes_remaining": 2,
        "email_change_year": datetime.now(timezone.utc).year,
        "created_at": now,
        "updated_at": now,
    }
    try:
        with db_connection() as connection:
            connection.execute(
                """
                INSERT INTO users
                  (id, access_key_hash, username, email, email_changes_remaining,
                   email_change_year, created_at, updated_at)
                VALUES (:id, :access_key_hash, :username, :email, :email_changes_remaining,
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
                  (id, user_id, folder, sender, recipient, subject, body, received_at, is_read)
                VALUES (?, ?, 'inbox', ?, ?, ?, ?, ?, 0)
                """,
                (
                    new_id(),
                    user["id"],
                    f"hello@{MAIL_DOMAIN}",
                    user["email"],
                    "Welcome to FPEDS",
                    "Your private inbox is ready. Send your first message from the compose button.",
                    now,
                ),
            )
    except sqlite3.IntegrityError:
        return error_response("That access key or username is already in use.", 409)
    session["user_id"] = user["id"]
    return jsonify({"user": public_user(user), "firstLogin": True}), 201


@app.post("/api/auth/signin")
def signin():
    data = request.get_json(silent=True) or {}
    access_key = str(data.get("accessKey", "")).strip()
    if not valid_access_key(access_key):
        return error_response("Access key rejected.", 401)
    with db_connection() as connection:
        user = connection.execute("SELECT * FROM users").fetchall()
    matching = next((row for row in user if check_access_key(access_key, row["access_key_hash"])), None)
    if not matching:
        return error_response("Access key rejected.", 401)
    session["user_id"] = matching["id"]
    return jsonify({"user": public_user(matching), "firstLogin": False})


@app.post("/api/auth/signout")
def signout():
    session.clear()
    return ("", 204)


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
        "<h1>FPEDS</h1><p>Build the React frontend before starting the production server.</p>",
        503,
    )


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))