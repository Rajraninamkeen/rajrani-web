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
}

export interface OrderPublic {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: string;
  placedAt: string;
  items: OrderItemPublic[];
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

export interface ReturnRequestPublic {
  id: string;
  orderId: string;
  orderNumber?: string;
  status: string;
  reasonCode: string;
  reasonNote?: string | null;
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
