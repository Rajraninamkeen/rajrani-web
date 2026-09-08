-- Session 40 — buyer-facing notification categories (additive native PG enum values)
ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'ORDER_STATUS';
ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'RETURN_STATUS';
