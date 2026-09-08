-- Session 19: add REFUND_FAILED event type (gateway refund.failed -> Refund FAILED).
ALTER TYPE "ReturnEventType" ADD VALUE IF NOT EXISTS 'REFUND_FAILED';
