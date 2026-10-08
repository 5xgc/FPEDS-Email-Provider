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
        work_nonce = 0
        while not service.hashlib.sha256(
            f"{challenge['token']}:{work_nonce}".encode("utf-8")
        ).hexdigest().startswith("000"):
            work_nonce += 1
        return {
            "captchaToken": challenge["token"],
            "captchaAnswer": str(int(left) + int(right)),
            "captchaWorkNonce": str(work_nonce),
            "website": "",
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

            paused = self.client.post(
                "/api/admin/control",
                json={"key": "sendingEnabled", "enabled": False, "durationMinutes": 15},
            )
            self.assertEqual(paused.status_code, 200)
            state = service.control_state()
            self.assertFalse(state["sendingEnabled"])
            self.assertIsNotNone(state["sendingEnabledUntil"])
            invalid_pause = self.client.post(
                "/api/admin/control",
                json={"key": "receivingEnabled", "enabled": False, "durationMinutes": 1441},
            )
            self.assertEqual(invalid_pause.status_code, 400)

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
        self.assertTrue(all(response.status_code == 400 for response in results[:4]))
        self.assertTrue(all(response.status_code == 429 for response in results[4:]))
        retry_after = int(results[-1].headers["Retry-After"])
        self.assertGreaterEqual(retry_after, 1)
        self.assertLessEqual(retry_after, 60)

    def test_admin_vault_is_generated_as_an_encrypted_browser_credential_file(self):
        vault_path = Path(self.database_dir.name) / "bye" / "admin-access.enc"
        password = "unit-test-vault-passphrase-7d3a9e5b"
        with (
            patch.object(service, "ADMIN_VAULT_PATH", vault_path),
            patch.object(service, "ADMIN_VAULT_PASSWORD", password),
            patch.dict(service.os.environ, {"MORALTOWN_ADMIN_ACCESS_KEY": ""}),
        ):
            access_key = service.load_admin_access_key()
            envelope_text = vault_path.read_text(encoding="utf-8")
            envelope = json.loads(envelope_text)
            self.assertRegex(access_key, r"^\d{50}$")
            self.assertEqual(envelope["format"], "fpeds-encrypted-key")
            self.assertEqual(envelope["username"], "admin")
            self.assertNotIn(access_key, envelope_text)
            self.assertEqual(service._read_admin_vault(password), access_key)
            with self.assertRaises(service.InvalidTag):
                service._read_admin_vault("incorrect-vault-password")
            self.assertEqual(vault_path.stat().st_mode & 0o777, 0o600)

    def test_cross_site_state_changes_are_rejected(self):
        response = self.client.post(
            "/api/auth/signout",
            headers={"Sec-Fetch-Site": "cross-site"},
        )
        self.assertEqual(response.status_code, 403)

    def test_expired_operational_pauses_resume_automatically(self):
        expired = str(int(service.time.time()) - 1)
        service.write_system_setting("api_paused", "1")
        service.write_system_setting("api_paused_expires_at", expired)
        service.write_system_setting("sending_enabled", "0")
        service.write_system_setting("sending_enabled_expires_at", expired)
        service.write_system_setting("receiving_enabled", "0")
        service.write_system_setting("receiving_enabled_expires_at", expired)

        controls = service.control_state()
        self.assertFalse(controls["apiPaused"])
        self.assertTrue(controls["sendingEnabled"])
        self.assertTrue(controls["receivingEnabled"])


if __name__ == "__main__":
    unittest.main()
