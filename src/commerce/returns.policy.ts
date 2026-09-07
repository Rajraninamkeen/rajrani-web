// Centralized business policy for returns/refunds (Master-Spec §88 "configuration":
// business constants belong server-side, not scattered in the frontend).
// When a config store exists these should move there.

/** Days after delivery during which a customer may request a return. */
export const RETURN_WINDOW_DAYS = 7;

/**
 * Fraction of a line's proportional refund kept when inspection returns
 * PARTIAL_PASS (item used/damaged). FAIL => 0; PASS => full share.
 */
export const INSPECTION_PARTIAL_PASS_RATE = 0.5;

export const MAX_REFUND_NOTE_LENGTH = 300;
