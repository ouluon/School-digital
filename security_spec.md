# Security Specification — Per-Account Custom Holidays & Auto-Saved Gradebooks

## Phase 1 & 2: Collection & Relationship Mapping
- **Master Anchor**: `/users/{userId}` (`UserAccount`) — owned strictly by `request.auth.uid == userId`, stores only `{ uid, createdAt }` (zero PII such as email/phone stored in Firestore).
- **Subcollection 1**: `/users/{userId}/customHolidays/{holidayId}` (`CustomHoliday`) — per-teacher custom off-days and school holidays.
  - Parent relationship enforced synchronously on `create` via `existsAfter(/databases/$(database)/documents/users/$(userId))` and `getAfter(...).data.uid == request.auth.uid`.
  - List queries enforce `isOwner(userId) && resource.data.userId == request.auth.uid` (no `get()`/`exists()` inside `allow list`).
- **Subcollection 2**: `/users/{userId}/gradebooks/{gradebookId}` (`UserGradebook`) — per-teacher auto-saved class settings, student roster, attendance, monthly/semester scores, domain grades, remarks, and active Google Sheet pointer.
  - Parent relationship enforced synchronously on `create` via `existsAfter` / `getAfter` on `/users/{userId}`.
  - Updates enforce immutable `userId` and `createdAt`, server-controlled `updatedAt == request.time`, and strict `affectedKeys().hasOnly(...)` allow-list.

## Data Invariants
1. Unauthenticated requests (`request.auth == null`) are denied all reads and writes.
2. Unverified email tokens (`request.auth.token.email_verified != true`) are denied all writes.
3. A teacher (`uidA`) can never read, list, create, update, or delete `/users/{uidB}/...` where `uidA != uidB`.
4. Every `CustomHoliday` document must contain strictly `['userId', 'date', 'title', 'createdAt']`—no extra shadow fields allowed.
5. `CustomHoliday.userId` and `UserGradebook.userId` must strictly equal both the path `{userId}` and `request.auth.uid`.
6. `CustomHoliday.date` must match `^\d{4}-\d{2}-\d{2}$` (length 10), and `title` must be length `1..120`.
7. `UserGradebook` documents must contain strictly `['userId', 'settings', 'students', 'attendanceByMonth', 'monthlyScoresByMonth', 'semesterScoresByTerm', 'domainGradesByTerm', 'remarks', 'activeSheet', 'createdAt', 'updatedAt']` with bounded map/list sizes (`students <= 200`, `attendanceByMonth <= 36`, `monthlyScoresByMonth <= 36`, `semesterScoresByTerm <= 6`, `domainGradesByTerm <= 6`, `remarks <= 200`, `settings <= 30`).
8. `createdAt` and `updatedAt` must equal `request.time` (server timestamp only), and `createdAt` is immutable on update.
9. All path IDs (`{userId}`, `{holidayId}`, `{gradebookId}`) must satisfy `^[a-zA-Z0-9_\-]+$` and length `1..128`.
10. Direct `update` operations on `UserAccount` and `CustomHoliday` are disabled (`allow update: if false;`).

## The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: Anonymous client calls `getDocs(/users/teacherA/customHolidays)` or `getDoc(/users/teacherA/gradebooks/default)`.
2. **Unauthenticated Write**: Anonymous client writes valid `CustomHoliday` or `UserGradebook` under `/users/teacherA/...`.
3. **Cross-Tenant List**: Authenticated `teacherB` queries `/users/teacherA/customHolidays` or `/users/teacherA/gradebooks`.
4. **Cross-Tenant Create (Path Spoof)**: Authenticated `teacherB` writes to `/users/teacherA/...` with `userId: 'teacherA'`.
5. **Identity Spoofing in Body**: Authenticated `teacherA` writes under `/users/teacherA/...` with `userId: 'teacherB'`.
6. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to create or update `/users/teacherA/...`.
7. **Shadow / Ghost Field Injection**: Authenticated `teacherA` includes extra field `{ isAdmin: true }` alongside valid fields.
8. **Missing Required Field**: Authenticated `teacherA` omits `createdAt`, `updatedAt`, or `title`.
9. **Client-Forged Timestamp**: Authenticated `teacherA` sends past/future `createdAt` or `updatedAt` instead of `request.time`.
10. **Denial-of-Wallet Oversized Payload / ID**: Authenticated `teacherA` sends 500-char `title` (`> 120`), `> 200` students, or malformed document ID (`bad/id!@#`).
11. **Invalid Date Format**: Authenticated `teacherA` sends `date: "14-04-2026"` or `date: "2026/04/14"`.
12. **Immutable Field Mutation on Update**: Authenticated `teacherA` attempts to overwrite `userId` or `createdAt` when updating `UserGradebook`, or updates `CustomHoliday` directly.

