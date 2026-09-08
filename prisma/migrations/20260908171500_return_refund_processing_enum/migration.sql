-- Session 18: add REFUND_PROCESSING event type (async gateway refund submitted).
ALTER TYPE "ReturnEventType" ADD VALUE IF NOT EXISTS 'REFUND_PROCESSING';
