import json
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import app as service


class SecurityControlsTests(unittest.TestCase):
    def setUp(self):
        self.database_dir = tempfile.TemporaryDirectory(prefix="moraltown-security-test-")
        self.previous_database_path = service.DATABASE_PATH
        service.DATABASE_PATH = Path(self.database_dir.name) / "security.sqlite3"
        service.RATE_LIMITS.clear()
        service.init_db()
        self.client = service.app.test_client()
        self.user_id = service.new_id()
        self.username = "securitytest"
        self.email = service.mailbox_address(self.username)
        now = service.utc_now()
        with service.db_connection() as connection:
            connection.execute(
                """
                INSERT INTO users
                  (id, access_key_hash, username, email, email_change_year,
                   created_at, updated_at)
                VALUES (?, ?, ?, ?, 2026, ?, ?)
                """,
                (
                    self.user_id,
                    service.hash_access_key("482019" * 8 + "42"),
                    self.username,
                    self.email,
                    now,
                    now,
                ),
            )

    def tearDown(self):
        service.DATABASE_PATH = self.previous_database_path
        service.RATE_LIMITS.clear()
        self.database_dir.cleanup()

    def captcha_payload(self):
        challenge = self.client.get("/api/security/captcha").get_json()
        left, right = re.findall(r"\d+", challenge["question"])
        return {
            "captchaToken": challenge["token"],
            "captchaAnswer": str(int(left) + int(right)),
        }

    def sign_in_test_user(self):
        with self.client.session_transaction() as user_session:
            user_session["user_id"] = self.user_id

    def test_captcha_is_single_use_and_no_default_access_code_is_accepted(self):
        proof = self.captcha_payload()
        payload = {"accessCode": "moraltown1919", **proof}
        with patch.object(service, "FREE_ACCESS_CODE", ""):
            first = self.client.post("/api/auth/check-access-code", json=payload)
            replay = self.client.post("/api/auth/check-access-code", json=payload)
        self.assertEqual(first.status_code, 200)
        self.assertFalse(first.get_json()["valid"])
        self.assertEqual(replay.status_code, 400)

    def test_lockdown_blocks_mailbox_api_and_exposes_only_safe_public_state(self):
        service.write_system_setting("lockdown", "1")
        service.write_system_setting("lockdown_message", "Maintenance in progress")
        status = self.client.get("/api/site/status")
        self.assertEqual(status.status_code, 200)
        self.assertEqual(status.get_json()["lockdownMessage"], "Maintenance in progress")
        self.assertEqual(self.client.get("/api/messages").status_code, 503)
        self.assertNotIn("SESSION_SECRET", json.dumps(status.get_json()))

    def test_admin_routes_require_an_authorized_role(self):
        self.assertEqual(self.client.get("/api/admin/overview").status_code, 401)
        self.sign_in_test_user()
        self.assertEqual(self.client.get("/api/admin/overview").status_code, 403)
        self.assertEqual(self.client.get("/api/admin/users").status_code, 403)

    def test_admin_key_enables_control_panel_and_admin_only_role_changes(self):
        admin_key = "407123" * 8 + "42"
        with patch.object(service, "ADMIN_ACCESS_KEY", admin_key):
            signed_in = self.client.post(
                "/api/auth/signin",
                json={"accessKey": admin_key, **self.captcha_payload()},
            )
            self.assertEqual(signed_in.status_code, 200)
            self.assertEqual(self.client.get("/api/admin/overview").status_code, 200)

            promoted = self.client.patch(
                f"/api/admin/users/{self.user_id}",
                json={"role": "co_founder"},
            )
            self.assertEqual(promoted.status_code, 200)

            cofounder_client = service.app.test_client()
            with cofounder_client.session_transaction() as user_session:
                user_session["user_id"] = self.user_id
            denied = cofounder_client.patch(
                f"/api/admin/users/{self.user_id}",
                json={"role": "admin"},
            )
            self.assertEqual(denied.status_code, 403)

            service.write_system_setting("lockdown", "1")
            self.assertEqual(self.client.get("/api/admin/overview").status_code, 200)
            self.assertEqual(self.client.get("/api/messages").status_code, 503)

    def test_security_check_lists_routes_without_secret_values(self):
        self.sign_in_test_user()
        test_secrets = (
            "test-only-brevo-secret-value",
            "test-only-mailgun-signing-secret",
        )
        with patch.dict(
            service.os.environ,
            {
                "BREVO_API_KEY": test_secrets[0],
                "MAILGUN_SIGNING_KEY": test_secrets[1],
            },
        ):
            response = self.client.get("/api/security/check")
        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertTrue(any(route["path"] == "/api/messages" for route in result["routes"]))
        self.assertTrue(any(service_row["id"] == "session-encryption" for service_row in result["services"]))
        serialized = json.dumps(result)
        for test_secret in test_secrets:
            self.assertNotIn(test_secret, serialized)

    def test_inbound_mail_is_encrypted_in_sqlite(self):
        self.assertTrue(
            service.store_inbound(
                "sender@example.test",
                self.email,
                "Private subject",
                "Private message body",
            )
        )
        with service.db_connection() as connection:
            row = connection.execute(
                "SELECT * FROM messages WHERE user_id = ?", (self.user_id,)
            ).fetchone()
        self.assertEqual(row["content_encrypted"], 1)
        self.assertNotIn("Private message body", row["body"])
        self.assertEqual(service.public_message(row)["body"], "Private message body")

    def test_authentication_rate_limit_applies_before_key_verification(self):
        results = [
            self.client.post("/api/auth/signin", json={"accessKey": "0" * 50})
            for _ in range(13)
        ]
        self.assertTrue(all(response.status_code == 400 for response in results[:12]))
        self.assertEqual(results[-1].status_code, 429)
        retry_after = int(results[-1].headers["Retry-After"])
        self.assertGreaterEqual(retry_after, 1)
        self.assertLessEqual(retry_after, 60)


if __name__ == "__main__":
    unittest.main()
