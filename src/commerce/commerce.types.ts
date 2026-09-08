import { OrderStatus } from '../generated/prisma/client';

export interface AddressInput {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export interface CartLinePublic {
  id?: string; // cart_item row id; required to PATCH/DELETE /cart/items/:id
  productId: string;
  name: string;
  image: string | null;
  price: number; // authoritative selling price at serve time
  originalPrice: number | null;
  quantity: number;
  weight: string | null;
  lineTotal: number;
}

export interface CartPublic {
  cartId: string;
  status: string;
  items: CartLinePublic[];
  itemCount: number;
  subtotal: number;
}

export interface PriceBreakdown {
  subtotal: number;
  discount: number; // MRP - selling savings (discountTotal)
  couponDiscount: number;
  couponCode?: string | null;
  deliveryCharge: number;
  tax: number;
  grandTotal: number;
}

export interface OrderItemPublic {
  orderItemId?: string;
  productId: string;
  productName: string;
  sku?: string | null;
  weight?: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  sellerId?: string;
  sellerName?: string | null;
}

/** A seller's slice of a split order (Session 09). */
export interface SellerOrderPublic {
  id: string;
  sellerOrderNumber: string;
  sellerId: string;
  sellerName: string;
  status: string;
  itemCount: number;
  subtotal: number;
  grandTotal: number;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
}

export interface OrderPublic {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: string;
  placedAt: string;
  items: OrderItemPublic[];
  sellerOrders?: SellerOrderPublic[];
  price: PriceBreakdown;
}

export interface OrderListQuery {
  page?: number;
  limit?: number;
  status?: OrderStatus;
}

export interface OrderListResult {
  orders: OrderPublic[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaymentIntentPublic {
  id: string;
  paymentReference: string;
  provider: string;
  method: string;
  amount: number;
  currency: string;
  state: string;
  clientSecret?: string | null;
  confirmedAt?: string | null;
}

export interface OrderPaymentResult {
  order: OrderPublic;
  payment: PaymentIntentPublic | null; // non-null for PREPAID orders
}

export interface CodVerificationPublic {
  id: string;
  orderId: string;
  status: string;
  secondaryContact?: string | null;
  attemptsUsed: number;
  attemptsAllowed: number;
  otpExpiresAt?: string | null;
  devOtp?: string | null; // SANDBOX only: simulated OTP for local/dev verification
  completedAt?: string | null;
}

export interface RefundPublic {
  id: string;
  refundReference: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  gatewayRef?: string | null;
  initiatedAt: string;
  completedAt?: string | null;
}

export interface ReturnEvidencePublic {
  id: string;
  storageObjectId: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  kind: string;
  uploadedBy?: string | null;
  uploadedAt: string;
}

export interface ReplacementPublic {
  id: string;
  replacementReference: string;
  status: string;
  quantityTotal: number;
  issuedBy?: string | null;
  issuedAt: string;
  dispatchedAt?: string | null;
  dispatchReference?: string | null;
  dispatchNote?: string | null;
  dispatchBy?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  // Session 22: courier last-mile assignments (most recent first) that will deliver
  // this dispatched replacement. Only surfaced when a courier has been assigned.
  assignments?: ReplacementAssignmentPublic[];
}

export interface ReplacementAssignmentPublic {
  id: string;
  assignmentNumber: string;
  replacementId: string;
  replacementReference?: string | null;
  returnRequestId: string;
  orderId: string;
  status: string; // DeliveryAssignmentStatus
  quantityTotal?: number | null;
  deliveryPartner: { id: string; partnerCode: string; name: string } | null;
  assignedAt: string;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  rejectedAt: string | null;
  failureReason: string | null;
  cancelledAt: string | null;
  // Operational delivery detail (DELIVERY partner / operator task view). From the
  // original order's address snapshot. Not exposed on the customer-facing return.
  customer?: {
    name?: string | null;
    phone?: string | null;
    address: unknown;
  } | null;
}

export interface ReturnRequestPublic {
  id: string;
  orderId: string;
  orderNumber?: string;
  status: string;
  resolution: string; // REFUND | REPLACEMENT (Session 16)
  reasonCode: string;
  reasonNote?: string | null;
  evidenceRequired: boolean;
  requestedAt: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  decisionReason?: string | null;
  pickupScheduledAt?: string | null;
  pickedUpAt?: string | null;
  inspectedAt?: string | null;
  approvedForRefundAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  items: ReturnItemPublic[];
  evidence: ReturnEvidencePublic[];
  replacement?: ReplacementPublic | null;
  refund?: RefundPublic | null;
}

export interface ReturnItemPublic {
  id: string;
  orderItemId: string;
  productName?: string | null;
  quantity: number;
  conditionNotes?: string | null;
  inspectionResult?: string | null;
  refundAmount?: number | null;
  replacementRequested: boolean;
}
