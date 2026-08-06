# Security Specification: AURUM LUXURY

## 1. Data Invariants
- Users can only read their own private data (orders, notifications).
- Only Merchants/Admins can create products/shops.
- Products belong to shops.
- Stories are public but only the creator can delete/edit.
- Orders are immutable once placed (except for status by admin).
- Admin (`alalikhader686@gmail.com`) has total access.

## 2. The Dirty Dozen Payloads (Rejection Tests)
1. **Identity Spoofing**: User A trying to create an order with User B's `userId`.
2. **Role Escalation**: User A trying to update their own `role` to 'admin' in `users` collection.
3. **Ghost Field**: Adding `isVerified: true` to a product during update.
4. **Invalid Type**: Setting `price` as a boolean instead of a string.
5. **Size Abuse**: Injecting a 2MB string into a story `text`.
6. **Orphaned Order**: Creating an order for a user that doesn't exist in `users`.
7. **Cross-Shop Injection**: Merchant A trying to update a product belonging to Merchant B.
8. **Story Hijacking**: User A trying to delete User B's story.
9. **Rent Invoice Manipulation**: Merchant trying to set their own invoice status to 'verified'.
10. **Unauthenticated Write**: Trying to add a notification without being signed in.
11. **Stale Timestamp**: Providing a `createdAt` from 1 year ago.
12. **Mall Bypass**: Customer trying to set `section: 'home'` for their product (if they were able to create one).

## 3. Test Runner (Draft)
A comprehensive test file `firestore.rules.test.ts` will verify these rejections.
