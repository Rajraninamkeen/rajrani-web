// Centralized business policy for returns/refunds (Master-Spec §88 "configuration":
// business constants belong server-side, not scattered in the frontend).
// When a config store exists these should move there.

/** Days after delivery during which a customer may request a return. */
export const RETURN_WINDOW_DAYS = 7;

export const MAX_REFUND_NOTE_LENGTH = 300;
