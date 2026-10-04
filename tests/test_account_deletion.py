import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import app as moraltown


class AccountDeletionTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.previous_db_path = moraltown.DATABASE_PATH
        moraltown.DATABASE_PATH = Path(self.temp_dir.name) / "test.sqlite3"
        self.previous_testing = moraltown.app.config["TESTING"]
        moraltown.app.config["TESTING"] = True
        moraltown.init_db()
        self.client = moraltown.app.test_client()
        self.user_id = moraltown.new_id()
        self.access_key = "7319052846" * 5
        now = moraltown.utc_now()
        username = "deletion-test"
        self.email = moraltown.mailbox_address(username)
        with moraltown.db_connection() as connection:
            connection.execute(
                """
                INSERT INTO users
                  (id, access_key_hash, access_key_ciphertext, username, email,
                   purchase_email, email_changes_remaining, email_change_year,
                   created_at, updated_at)
                VALUES (?, ?, NULL, ?, ?, ?, 2, ?, ?, ?)
                """,
                (
                    self.user_id,
                    moraltown.hash_access_key(self.access_key),
                    username,
                    self.email,
                    "buyer@example.test",
                    datetime.now(timezone.utc).year,
                    now,
                    now,
                ),
            )
            connection.execute(
                "INSERT INTO folders (id, user_id, name, created_at) VALUES (?, ?, ?, ?)",
                (moraltown.new_id(), self.user_id, "inbox", now),
            )
            connection.execute(
                """
                INSERT INTO messages
                  (id, user_id, sender, recipient, subject, body, received_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    moraltown.new_id(),
                    self.user_id,
                    "sender@example.test",
                    self.email,
                    "Private message",
                    "Message body",
                    now,
                ),
            )
            connection.execute(
                """
                INSERT INTO notifications
                  (id, user_id, kind, title, message, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    moraltown.new_id(),
                    self.user_id,
                    "account",
                    "Private notice",
                    "Account-specific notification",
                    now,
                ),
            )
            connection.execute(
                """
                INSERT INTO subscriptions
                  (id, user_id, email, label, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (moraltown.new_id(), self.user_id, "news@example.test", "News", now),
            )
            connection.execute(
                """
                INSERT INTO payment_orders
                  (id, currency, address, amount_units, amount_text, price_usd,
                   created_at, expires_at, contact_email, claim_token_hash,
                   claim_token_ciphertext, claim_origin)
                VALUES (?, 'BTC', 'public-address', '1', '0.00000001', '5.00',
                        1000, 2000, ?, 'claim-hash', 'claim-secret', 'https://example.test')
                """,
                (moraltown.new_id(), self.email),
            )
        with self.client.session_transaction() as user_session:
            user_session["user_id"] = self.user_id

    def tearDown(self):
        moraltown.DATABASE_PATH = self.previous_db_path
        moraltown.app.config["TESTING"] = self.previous_testing
        self.temp_dir.cleanup()

    def test_deletion_revokes_access_and_scrubs_app_records_immediately(self):
        wrong_origin = self.client.post(
            "/api/account/deletion",
            json={"accessKey": self.access_key},
            headers={"Origin": "https://attacker.example"},
        )
        self.assertEqual(wrong_origin.status_code, 403)

        wrong_key = self.client.post(
            "/api/account/deletion",
            json={"accessKey": "0" * 50},
            headers={"Origin": "http://localhost"},
        )
        self.assertEqual(wrong_key.status_code, 403)

        response = self.client.post(
            "/api/account/deletion",
            json={"accessKey": self.access_key},
            headers={"Origin": "http://localhost"},
        )
        self.assertEqual(response.status_code, 202)
        result = response.get_json()
        self.assertEqual(result["durationSeconds"], 240)
        self.assertEqual(
            self.client.get("/api/auth/me").status_code,
            401,
            "the cleared session and tombstone must revoke access immediately",
        )

        with moraltown.db_connection() as connection:
            for table in ("messages", "folders", "notifications", "subscriptions"):
                count = connection.execute(
                    f"SELECT COUNT(*) FROM {table} WHERE user_id = ?",
                    (self.user_id,),
                ).fetchone()[0]
                self.assertEqual(count, 0, f"{table} should be cleared at request time")
            order = connection.execute(
                "SELECT * FROM payment_orders WHERE contact_email IS NULL"
            ).fetchone()
            self.assertIsNotNone(order)
            self.assertIsNone(order["claim_token_hash"])
            self.assertIsNone(order["claim_token_ciphertext"])
            self.assertIsNone(order["claim_origin"])

        status = self.client.get(
            "/api/account/deletion/status",
            headers={"Authorization": f"Bearer {result['deletionToken']}"},
        )
        self.assertEqual(status.status_code, 200)
        self.assertEqual(status.get_json()["status"], "running")

        self.assertEqual(
            moraltown.process_due_account_deletions(now=result["completesAt"]),
            1,
        )
        with moraltown.db_connection() as connection:
            self.assertIsNone(
                connection.execute(
                    "SELECT id FROM users WHERE id = ?", (self.user_id,)
                ).fetchone()
            )
        final_status = self.client.get(
            "/api/account/deletion/status",
            headers={"Authorization": f"Bearer {result['deletionToken']}"},
        )
        self.assertEqual(final_status.get_json()["status"], "complete")


if __name__ == "__main__":
    unittest.main()