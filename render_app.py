"""Gunicorn entry point that starts the persistent background workers."""

from app import (
    app,
    start_account_deletion_worker,
    start_payment_monitor,
)

start_payment_monitor()
start_account_deletion_worker()