---
name: MoralTown mailbox accounts
description: Product rule for adding and switching among mailbox addresses under one access key.
---

One original access-key account can own multiple separately selectable mailbox addresses. Each
mailbox keeps its own messages and folders, while signing in with the original key exposes the
whole mailbox list.

**Why:** The user asked for additional addresses to be created under the existing account rather
than requiring a new access key for each address.

**How to apply:** Preserve a stable owner identity for mailbox selection and authorization; scope
message and folder operations to the active mailbox, and never make another mailbox address
readable or writable just because its owner is shared.
