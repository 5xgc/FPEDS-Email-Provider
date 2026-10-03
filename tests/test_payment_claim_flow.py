import json
import os
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

os.environ.setdefault("SQLITE_PATH", str(Path(tempfile.mkdtemp()) / "import.sqlite3"))
os.environ.setdefault("SESSION_SECRET", "payment-flow-tests-only")

import app as service


class PaymentClaimFlowTests(unittest.TestCase):
    def setUp(self):
        self.database_dir = tempfile.TemporaryDirectory(prefix="moraltown-payment-test-")
        self.previous_database_path = service.DATABASE_PATH
        self.previous_free_access_code = service.FREE_ACCESS_CODE
        self.environment_patch = patch.dict(
            os.environ, {"SESSION_SECRET": "payment-flow-tests-only"}, clear=False
        )
        self.environment_patch.start()
        service.DATABASE_PATH = Path(self.database_dir.name) / "app.sqlite3"
        service.FREE_ACCESS_CODE = "moraltown1919"
        service.app.config["SECRET_KEY"] = "payment-flow-tests-only"
        service.init_db()
        self.client = service.app.test_client()

    def tearDown(self):
        service.DATABASE_PATH = self.previous_database_path
        service.FREE_ACCESS_CODE = self.previous_free_access_code
        self.environment_patch.stop()
        self.database_dir.cleanup()

    def create_confirmed_order(self, email: str, token: str, order_id: str):
        now = 1_900_000_000
        with service.db_connection() as connection:
            connection.execute(
                """
                INSERT INTO payment_orders
                  (id, currency, address, derive_index, amount_units, amount_text,
                   price_usd, start_height, status, received_units, transaction_id,
                   confirmations, last_checked_at, created_at, expires_at,
                   contact_email, claim_token_hash, claim_token_ciphertext,
                   claim_origin)
                VALUES (?, 'BTC', 'bc1q-test-address', 1, '1500', '0.00001500',
                        '60000', 100, 'confirmed', '1500', 'tx-test', 1, ?,
                        ?, ?, ?, ?, ?, 'https://moraltown.example')
                """,
                (
                    order_id,
                    now,
                    now,
                    now - 1,
                    email,
                    service.hashlib.sha256(token.encode()).hexdigest(),
                    service.encrypt_access_key(token),
                ),
            )

    def test_payment_is_checked_automatically_and_claim_can_only_create_one_paid_account(self):
        with patch.object(service, "spot_usd", return_value=Decimal("60000")), patch.object(
            service, "amount_units_for_usd", return_value=1500
        ), patch.object(
            service,
            "address_and_start_height",
            return_value=("bc1q-payment-test-address", 100),
        ):
            created = self.client.post(
                "/api/payments/orders",
                json={"currency": "BTC", "email": "buyer@example.com"},
            )
        self.assertEqual(created.status_code, 201)
        order = created.get_json()
        self.assertEqual(order["expiresAt"] - int(__import__("time").time()), 7200)
        self.assertNotIn("purchaseToken", order)
        self.assertNotIn("contactEmail", order)

        with patch.object(service, "PAYMENT_CHECK_INTERVAL_SECONDS", 0), patch.object(
            service,
            "find_payment",
            return_value={"txid": "mainnet-payment-test", "confirmations": 1},
        ) as find_payment, patch.object(
            service, "send_resend_payment_confirmation"
        ) as send_email:
            service.scan_payment_orders_once()
            checked = self.client.get(f"/api/payments/orders/{order['id']}")

        self.assertEqual(checked.status_code, 200)
        confirmed = checked.get_json()
        self.assertEqual(confirmed["status"], "confirmed")
        self.assertTrue(confirmed["confirmationEmailSent"])
        find_payment.assert_called_once()
        send_email.assert_called_once()
        self.assertEqual(send_email.call_args.args[0], "buyer@example.com")
        claim_url = send_email.call_args.args[1]
        claim_token = parse_qs(urlparse(claim_url).query)["token"][0]

        # Confirmed claims stay valid after the two-hour payment window has passed.
        with service.db_connection() as connection:
            connection.execute(
                "UPDATE payment_orders SET expires_at = 1 WHERE id = ?",
                (order["id"],),
            )
        valid = self.client.get(
            "/api/payments/claims/validate",
            query_string={"token": claim_token},
        )
        self.assertTrue(valid.get_json()["valid"])

        first_signup = self.client.post(
            "/api/auth/signup",
            json={
                "accessKey": "1" * 50,
                "username": "paidbuyer",
                "claimToken": claim_token,
            },
        )
        self.assertEqual(first_signup.status_code, 201)
        invalid_after_use = self.client.get(
            "/api/payments/claims/validate",
            query_string={"token": claim_token},
        )
        self.assertFalse(invalid_after_use.get_json()["valid"])

        second_token = "second-order-claim-token"
        self.create_confirmed_order(
            "buyer@example.com", second_token, "second-test-order"
        )
        blocked = self.client.post(
            "/api/auth/signup",
            json={
                "accessKey": "2" * 50,
                "username": "anotherpaid",
                "claimToken": second_token,
            },
        )
        self.assertEqual(blocked.status_code, 409)

        with patch.object(service, "FREE_ACCESS_CODE", "configured-custom-code"):
            access_code_signup = self.client.post(
                "/api/auth/signup",
                json={
                    "accessKey": "2" * 50,
                    "username": "anotherpaid",
                    "accessCode": "moraltown1919",
                },
            )
        self.assertEqual(access_code_signup.status_code, 201)
        with service.db_connection() as connection:
            paid_accounts = connection.execute(
                "SELECT COUNT(*) FROM users WHERE purchase_email = ?",
                ("buyer@example.com",),
            ).fetchone()[0]
            access_code_accounts = connection.execute(
                "SELECT COUNT(*) FROM users WHERE purchase_email IS NULL"
            ).fetchone()[0]
        self.assertEqual(paid_accounts, 1)
        self.assertEqual(access_code_accounts, 1)

    def test_confirmation_sender_is_the_requested_resend_address(self):
        class Response:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return None

        with patch.dict(os.environ, {"RESEND_API_KEY": "test-only-key"}), patch(
            "app.urlrequest.urlopen", return_value=Response()
        ) as send:
            service.send_resend_payment_confirmation(
                "buyer@example.com",
                "https://moraltown.example/claim?token=one-time",
                "order-test",
            )

        request = send.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(payload["from"], "auth@fpeds.2bd.net")
        self.assertEqual(payload["to"], ["buyer@example.com"])
        self.assertTrue(
            any(key.lower() == "idempotency-key" for key in request.headers)
        )
        self.assertIn("one-time", payload["text"])


if __name__ == "__main__":
    unittest.main()