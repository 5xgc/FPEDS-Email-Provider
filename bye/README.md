# Encrypted admin credential file

When `MORALTOWN_ADMIN_VAULT_PASSWORD` is set in Replit Secrets (use a random
passphrase of at least 32 characters), the server creates
`bye/admin-access.enc` on startup if it does not exist. The file contains the
random 50-digit admin access key encrypted with AES-GCM and PBKDF2. The raw key
and passphrase are never written to a plaintext file.

Use the app's “Sign in with an encrypted key file” option, choose
`admin-access.enc`, and enter the same passphrase. Keep a separate protected
backup of the encrypted file and the passphrase. Do not commit the encrypted
file or put the passphrase in this folder.

Without an active admin credential vault, the server marks mailbox access as
not ready and blocks mailbox API use.
