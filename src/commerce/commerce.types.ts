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
