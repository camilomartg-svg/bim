# Security Specification - Trevoly BIM Issues

## Data Invariants
1. A **User** profile must exist for any authenticated user before they can interact with the system.
2. An **Issue** must have a valid title, priority, and status.
3. The `creatorId` of an Issue must match the `request.auth.uid`.
4. Only the `assignee` or an admin can move an issue to Terminal States (`resolved`, `closed`).
5. **Comments** are linked to an Issue and inherit access rights simplified by the "Master Gate".
6. **Notifications** are private and can only be read/updated by the recipient.
7. **IDs** must match standard alphanumeric patterns and be size-limited.

## The "Dirty Dozen" (Attack Scenarios)
1. **Identity Theft**: User A tries to create an issue with `creatorId = "UserB"`.
2. **State Hijacking**: A guest user tries to move an issue from `open` to `closed`.
3. **Ghost Fields**: User A adds `isVerified: true` or `isAdmin: true` to their profile.
4. **ID Poisoning**: User tries to create an issue with an ID that is a 2MB string.
5. **PII Leak**: Non-admin tries to list all user emails.
6. **Relational Bypass**: User tries to comment on a non-existent issue.
7. **Timestamp Spoofing**: User sends a `createdAt` value from the future.
8. **Resource Exhaustion**: User tries to upload an array of 50,000 attachments in one issue.
9. **Role Escalation**: Manager tries to delete an Issue and the associated logs from the Root.
10. **Query Scraper**: Authenticated user tries to list all notifications for other users.
11. **Immutable Break**: User A tries to change the `originalCreatorId` of an existing issue.
12. **Null Pointer Trigger**: Sending malformed list queries meant to crash rules evaluation.

## Test Strategy
The `firestore.rules` will be evaluated against these blocks to ensure `PERMISSION_DENIED` for all malicious attempts.
