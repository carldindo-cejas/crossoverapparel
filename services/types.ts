export type UserRole = "customer" | "owner" | "designer";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "in_production"
  | "ready_to_ship"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "payment_failed";

export type PaymentStatus = "unpaid" | "partial" | "paid" | "failed" | "refunded";

export type PresenceState = "online" | "offline" | "break";
