export type GenderCategory = "Men" | "Women" | "Unisex" | "Kids";

export const SHOE_GENDERS: GenderCategory[] = ["Men", "Women", "Unisex", "Kids"];

export const SHOE_TYPES = [
  "Sneakers",
  "Running",
  "Casual",
  "Formal",
  "Sports",
  "Boots",
  "Sandals",
  "Loafers",
] as const;

export type ShoeType = (typeof SHOE_TYPES)[number];

export type ProductStatus = "active" | "draft" | "archived";

export type {
  AdminPaymentRecordDto,
  PaymentFormatOption,
  PaymentProviderConfigDto,
  PaymentProviderInfo,
  PaymentReceiptDto,
  PaymentReceiptStatus,
  PaymentStatusResponse,
  PaymentVerificationLogDto,
  PaymentVerificationResponse,
  ReceiptAccessUrlResponse,
  ReceiptCaptureMethod,
  ReceiptOcrExtractionDto,
  SubmitPaymentReceiptResponse,
  VerificationSource,
} from "@addisgebeya/types";

export type OrderStatus =
  | "PendingPayment"
  | "Confirmed"
  | "Processing"
  | "Shipped"
  | "Delivered"
  | "Cancelled"
  | "pending"
  | "confirmed"
  | "packed"
  | "out_for_delivery"
  | "shipped_regional"
  | "delivered"
  | "cancelled";

export type PaymentMethod = string;

export type PaymentStatus =
  | "Pending"
  | "VerificationPending"
  | "Paid"
  | "Failed"
  | "ReviewRequired"
  | "Refunded"
  | "pending"
  | "verified"
  | "cod_due"
  | "refunded";

export interface ShoeColorway {
  id: string;
  name: string;
  hex: string;
  secondaryHex?: string;
  soleHex?: string;
  images: string[];
  /** EU size (e.g. 38..46) -> available pair count */
  stockBySize: Record<number, number>;
  /** Minimum pair threshold for low-stock warning per EU size */
  lowStockThreshold?: number;
}

export interface ShoeSpecs {
  upperMesh: string;
  cushioning: string;
  outsoleGrip: string;
  weightGrams: number;
  heelDropMm: number;
  fitAdvice: string;
  materials: string[];
}

export interface ShoeReview {
  id: string;
  productId: string;
  authorName: string;
  authorInitials: string;
  location: string;
  purchasedSize: number;
  rating: number;
  title: string;
  comment: string;
  dateLabel: string;
  verified: boolean;
  helpfulCount: number;
  photoUrl?: string;
  tag?: string;
}

export interface ProductImageItem {
  id: string;
  productId?: string;
  colorwayId?: string | null;
  imageUrl: string;
  publicId?: string;
  isPrimary: boolean;
  altText?: string | null;
  displayOrder: number;
  createdAt?: string;
}

export interface ShoeProduct {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  categorySlug: string;
  categoryName: string;
  gender: GenderCategory;
  shoeType?: string;
  material?: string | null;
  tagline: string;
  description: string;
  priceETB: number;
  compareAtPriceETB?: number;
  cogsETB?: number;
  rating: number;
  reviewCount: number;
  badges: string[];
  status: ProductStatus;
  featuredTrending?: boolean;
  featuredNewDrop?: boolean;
  isOnSale?: boolean;
  freeAddisDelivery?: boolean;
  reserveShowroomPairs?: boolean;
  dispatchDepot?: string;
  colorways: ShoeColorway[];
  productImages?: ProductImageItem[];
  specs: ShoeSpecs;
  createdAt: string;
}

export interface ShoeCategory {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  eyebrow: string;
  description: string;
  image: string;
  featured: boolean;
  active: boolean;
}

export interface AccessoryItem {
  id: string;
  name: string;
  category: string;
  description: string;
  priceETB: number;
  badge: string;
  image: string;
}

export interface CartItem {
  id: string; // `${productId}__${colorwayId}__${size}`
  productId: string;
  productSlug: string;
  productName: string;
  categoryName: string;
  brand: string;
  colorwayId: string;
  colorwayName: string;
  colorHex: string;
  size: number;
  unitPriceETB: number;
  compareAtPriceETB?: number;
  quantity: number;
  image: string;
  badge?: string;
  isAccessory?: boolean;
}

export interface PromoCode {
  code: string;
  type: "fixed" | "percent";
  value: number;
  minSubtotalETB: number;
  description: string;
}

export interface OrderItemRecord {
  productId: string;
  productName: string;
  sku: string;
  colorwayName: string;
  size: number;
  quantity: number;
  unitPriceETB: number;
  image: string;
}

export interface OrderTrackingEvent {
  step: string;
  description: string;
  timestamp: string;
  completed: boolean;
  current?: boolean;
}

export interface OrderRecord {
  id: string; // e.g. AG-9482
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  city: string;
  subCity: string;
  landmark: string;
  riderNotes?: string;
  deliverySpeed: "standard" | "vip";
  deliveryFeeETB: number;
  subtotalETB: number;
  discountETB: number;
  promoCode?: string;
  totalETB: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  receiptStatus?: "Pending" | "Processing" | "Verified" | "Rejected" | "Manual Review" | "Approved" | null;
  verificationSource?: "pending" | "provider_api" | "admin_manual" | string;
  latestReceiptRejectionReason?: string | null;
  latestReceiptResubmissionRequested?: boolean;
  latestReceiptUrl?: string | null;
  latestReceiptId?: string | null;
  officialReceiptUrl?: string | null;
  cbeReceiptToken?: string | null;
  officialReceiptReason?: string | null;
  status: OrderStatus;
  courierName?: string;
  waybill?: string;
  items: OrderItemRecord[];
  trackingEvents: OrderTrackingEvent[];
  createdAt: string;
}

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  subCity: string;
  preferredSize: number;
  totalOrders: number;
  totalSpentETB: number;
  tier: "VIP Runner" | "Repeat Buyer" | "Member";
  joinedAt: string;
  avatarUrl?: string;
}

export interface PaymentSlipRecord {
  id: string;
  reference: string;
  provider: "Telebirr" | "CBE Birr" | "Awash Bank";
  amountETB: number;
  senderName: string;
  senderInfo: string;
  matchedOrderId?: string;
  receivedAt: string;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  showroomAddress: string;
  phone: string;
  whatsapp: string;
  telegramHandle: string;
  email: string;
  showroomHours: string;
  freeDeliveryThresholdETB: number;
  standardAddisDeliveryFeeETB: number;
  vipTwoHourDeliveryFeeETB: number;
  regionalCargoFeeETB: number;
  vatPercent: number;
  paymentMethods: {
    telebirr: boolean;
    cbeBirr: boolean;
    bankTransfer: boolean;
    cod: boolean;
  };
  announcementBarText: string;
  dispatchRibbonText: string;
  heroImageUrl?: string | null;
  heroBadgeText?: string;
  heroCardSubtitle?: string;
  heroCardTitle?: string;
  heroCardPriceText?: string;
  heroCardHref?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  role: "customer" | "admin";
  preferredSize: number;
  subCity: string;
  avatarUrl?: string;
  dateOfBirth?: string | null;
  emailVerifiedAt?: string | null;
  isActive?: boolean;
  createdAt?: string;
  totalOrders?: number;
  recentOrders?: Array<{
    id: string;
    totalETB: number;
    status: string;
    paymentStatus: string;
    createdAt: string;
    itemCount: number;
    firstItem?: {
      productName: string;
      size: number;
      quantity: number;
      image: string;
    } | null;
  }>;
  addresses?: AddressRecord[];
  defaultAddress?: AddressRecord | null;
}

export interface AddressRecord {
  id: string;
  userId: string;
  label?: string;
  fullName: string;
  phoneNumber: string;
  region: string;
  city: string;
  subCity: string;
  woreda?: string | null;
  streetAddress?: string | null;
  landmark?: string | null;
  riderNotes?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}


