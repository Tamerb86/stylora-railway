import { pgTable, serial, text, integer, decimal, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

// ==========================================
// CORE TABLES (Existing + Enhanced)
// ==========================================

export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role").notNull(), // 'owner', 'manager', 'employee'
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  duration: integer("duration").notNull(), // in minutes
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  customerId: integer("customerId").references(() => customers.id),
  employeeId: integer("employeeId").references(() => employees.id),
  serviceId: integer("serviceId").references(() => services.id),
  appointmentDate: timestamp("appointmentDate").notNull(),
  duration: integer("duration").notNull(),
  status: text("status").notNull().default("scheduled"), // 'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'
  notes: text("notes"),
  cancellationReason: text("cancellationReason"),
  verificationCode: text("verificationCode"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  customerId: integer("customerId").references(() => customers.id),
  appointmentId: integer("appointmentId").references(() => appointments.id),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'paid', 'cancelled', 'refunded'
  createdAt: timestamp("createdAt").defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  orderId: integer("orderId").references(() => orders.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: text("method").notNull(), // 'cash', 'card', 'vipps', 'invoice'
  provider: text("provider"), // 'stripe', 'vipps', 'nets', etc.
  transactionId: text("transactionId"),
  status: text("status").notNull().default("pending"), // 'pending', 'completed', 'failed', 'refunded'
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});

// ==========================================
// CRM & MARKETING TABLES
// ==========================================

export const customerSegments = pgTable("customerSegments", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'static' or 'dynamic'
  criteria: jsonb("criteria"), // For dynamic segments
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const customerSegmentMembers = pgTable("customerSegmentMembers", {
  id: serial("id").primaryKey(),
  segmentId: integer("segmentId").references(() => customerSegments.id, { onDelete: "cascade" }),
  customerId: integer("customerId").references(() => customers.id, { onDelete: "cascade" }),
  addedAt: timestamp("addedAt").defaultNow(),
});

export const marketingCampaigns = pgTable("marketingCampaigns", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'email', 'sms', 'both'
  subject: text("subject"),
  message: text("message").notNull(),
  segmentId: integer("segmentId").references(() => customerSegments.id),
  scheduledAt: timestamp("scheduledAt"),
  sentAt: timestamp("sentAt"),
  status: text("status").notNull().default("draft"), // 'draft', 'scheduled', 'sending', 'sent', 'failed'
  createdAt: timestamp("createdAt").defaultNow(),
});

export const campaignRecipients = pgTable("campaignRecipients", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").references(() => marketingCampaigns.id, { onDelete: "cascade" }),
  customerId: integer("customerId").references(() => customers.id),
  status: text("status").notNull().default("pending"), // 'pending', 'sent', 'delivered', 'failed', 'opened', 'clicked'
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  openedAt: timestamp("openedAt"),
  clickedAt: timestamp("clickedAt"),
  errorMessage: text("errorMessage"),
});

export const referralProgram = pgTable("referralProgram", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull().unique(),
  isActive: boolean("isActive").notNull().default(true),
  referrerRewardType: text("referrerRewardType").notNull(), // 'discount_percentage', 'discount_fixed', 'loyalty_points'
  referrerRewardValue: decimal("referrerRewardValue", { precision: 10, scale: 2 }).notNull(),
  refereeRewardType: text("refereeRewardType").notNull(),
  refereeRewardValue: decimal("refereeRewardValue", { precision: 10, scale: 2 }).notNull(),
  minimumPurchase: decimal("minimumPurchase", { precision: 10, scale: 2 }),
  validityDays: integer("validityDays").default(30),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  referrerId: integer("referrerId").references(() => customers.id),
  refereeId: integer("refereeId").references(() => customers.id),
  referralCode: text("referralCode").notNull().unique(),
  status: text("status").notNull().default("pending"), // 'pending', 'completed', 'expired'
  referrerRewardGiven: boolean("referrerRewardGiven").default(false),
  refereeRewardGiven: boolean("refereeRewardGiven").default(false),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow(),
  expiresAt: timestamp("expiresAt"),
});

export const giftCards = pgTable("giftCards", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  code: text("code").notNull().unique(),
  initialValue: decimal("initialValue", { precision: 10, scale: 2 }).notNull(),
  currentBalance: decimal("currentBalance", { precision: 10, scale: 2 }).notNull(),
  purchasedBy: integer("purchasedBy").references(() => customers.id),
  recipientName: text("recipientName"),
  recipientEmail: text("recipientEmail"),
  message: text("message"),
  status: text("status").notNull().default("active"), // 'active', 'redeemed', 'expired', 'cancelled'
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const giftCardTransactions = pgTable("giftCardTransactions", {
  id: serial("id").primaryKey(),
  giftCardId: integer("giftCardId").references(() => giftCards.id, { onDelete: "cascade" }),
  orderId: integer("orderId").references(() => orders.id),
  type: text("type").notNull(), // 'purchase', 'redemption', 'refund'
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  balanceBefore: decimal("balanceBefore", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const promoCodes = pgTable("promoCodes", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  discountType: text("discountType").notNull(), // 'percentage', 'fixed_amount'
  discountValue: decimal("discountValue", { precision: 10, scale: 2 }).notNull(),
  minimumPurchase: decimal("minimumPurchase", { precision: 10, scale: 2 }),
  maxDiscount: decimal("maxDiscount", { precision: 10, scale: 2 }),
  usageLimit: integer("usageLimit"),
  usageCount: integer("usageCount").default(0),
  perCustomerLimit: integer("perCustomerLimit"),
  validFrom: timestamp("validFrom").notNull(),
  validUntil: timestamp("validUntil").notNull(),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const promoCodeUsage = pgTable("promoCodeUsage", {
  id: serial("id").primaryKey(),
  promoCodeId: integer("promoCodeId").references(() => promoCodes.id, { onDelete: "cascade" }),
  customerId: integer("customerId").references(() => customers.id),
  orderId: integer("orderId").references(() => orders.id),
  discountAmount: decimal("discountAmount", { precision: 10, scale: 2 }).notNull(),
  usedAt: timestamp("usedAt").defaultNow(),
});

export const customerFeedback = pgTable("customerFeedback", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  customerId: integer("customerId").references(() => customers.id),
  appointmentId: integer("appointmentId").references(() => appointments.id),
  orderId: integer("orderId").references(() => orders.id),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  isPublic: boolean("isPublic").default(false),
  isApproved: boolean("isApproved").default(false),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const npsSurveys = pgTable("npsSurveys", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  customerId: integer("customerId").references(() => customers.id),
  score: integer("score").notNull(), // 0-10
  feedback: text("feedback"),
  createdAt: timestamp("createdAt").defaultNow(),
});

// ==========================================
// INVENTORY MANAGEMENT TABLES
// ==========================================

export const inventoryItems = pgTable("inventoryItems", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  barcode: text("barcode"),
  currentStock: integer("currentStock").notNull().default(0),
  minStock: integer("minStock").default(0),
  maxStock: integer("maxStock"),
  reorderPoint: integer("reorderPoint"),
  costPrice: decimal("costPrice", { precision: 10, scale: 2 }),
  sellingPrice: decimal("sellingPrice", { precision: 10, scale: 2 }),
  location: text("location"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  name: text("name").notNull(),
  contactPerson: text("contactPerson"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  paymentTerms: text("paymentTerms"),
  rating: integer("rating"),
  notes: text("notes"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const purchaseOrders = pgTable("purchaseOrders", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  orderNumber: text("orderNumber").notNull().unique(),
  supplierId: integer("supplierId").references(() => suppliers.id),
  status: text("status").notNull().default("draft"), // 'draft', 'sent', 'confirmed', 'received', 'cancelled'
  orderDate: timestamp("orderDate").notNull(),
  expectedDelivery: timestamp("expectedDelivery"),
  actualDelivery: timestamp("actualDelivery"),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const purchaseOrderItems = pgTable("purchaseOrderItems", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchaseOrderId").references(() => purchaseOrders.id, { onDelete: "cascade" }),
  inventoryItemId: integer("inventoryItemId").references(() => inventoryItems.id),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
  receivedQuantity: integer("receivedQuantity").default(0),
});

export const stockMovements = pgTable("stockMovements", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  inventoryItemId: integer("inventoryItemId").references(() => inventoryItems.id),
  type: text("type").notNull(), // 'purchase', 'sale', 'adjustment', 'transfer', 'return'
  quantity: integer("quantity").notNull(),
  reference: text("reference"),
  referenceId: integer("referenceId"),
  notes: text("notes"),
  createdBy: integer("createdBy"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const inventoryAlerts = pgTable("inventoryAlerts", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  inventoryItemId: integer("inventoryItemId").references(() => inventoryItems.id),
  type: text("type").notNull(), // 'low_stock', 'out_of_stock', 'overstock', 'expiring'
  message: text("message").notNull(),
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt").defaultNow(),
});

// ==========================================
// COMMISSION MANAGEMENT TABLES
// ==========================================

export const commissionRules = pgTable("commissionRules", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  calculationType: text("calculationType").notNull(), // 'percentage', 'fixed_amount', 'tiered'
  value: decimal("value", { precision: 10, scale: 2 }),
  tieredRates: jsonb("tieredRates"),
  appliesTo: text("appliesTo").notNull(), // 'all', 'services', 'products', 'specific_items'
  specificItems: jsonb("specificItems"),
  employeeId: integer("employeeId"),
  minSalesAmount: decimal("minSalesAmount", { precision: 10, scale: 2 }),
  priority: integer("priority").default(0),
  isActive: boolean("isActive").default(true),
  validFrom: timestamp("validFrom"),
  validUntil: timestamp("validUntil"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const commissions = pgTable("commissions", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  employeeId: integer("employeeId").notNull(),
  orderId: integer("orderId").references(() => orders.id),
  appointmentId: integer("appointmentId").references(() => appointments.id),
  ruleId: integer("ruleId").references(() => commissionRules.id),
  salesAmount: decimal("salesAmount", { precision: 10, scale: 2 }).notNull(),
  commissionAmount: decimal("commissionAmount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'paid', 'cancelled'
  period: text("period").notNull(), // 'YYYY-MM'
  paidAt: timestamp("paidAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const commissionTargets = pgTable("commissionTargets", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  employeeId: integer("employeeId"),
  name: text("name").notNull(),
  targetType: text("targetType").notNull(), // 'sales_amount', 'booking_count', 'customer_count'
  targetValue: decimal("targetValue", { precision: 10, scale: 2 }).notNull(),
  bonusType: text("bonusType").notNull(), // 'fixed_amount', 'percentage'
  bonusAmount: decimal("bonusAmount", { precision: 10, scale: 2 }).notNull(),
  period: text("period").notNull(), // 'monthly', 'quarterly', 'yearly'
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const commissionPayouts = pgTable("commissionPayouts", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  employeeId: integer("employeeId").notNull(),
  period: text("period").notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'paid', 'failed'
  paidAt: timestamp("paidAt"),
  paymentMethod: text("paymentMethod"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
});

// ==========================================
// CUSTOMER PORTAL TABLES
// ==========================================

export const customerAccounts = pgTable("customerAccounts", {
  id: serial("id").primaryKey(),
  customerId: integer("customerId").references(() => customers.id, { onDelete: "cascade" }).unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("passwordHash").notNull(),
  isEmailVerified: boolean("isEmailVerified").default(false),
  emailVerificationToken: text("emailVerificationToken"),
  passwordResetToken: text("passwordResetToken"),
  passwordResetExpires: timestamp("passwordResetExpires"),
  lastLoginAt: timestamp("lastLoginAt"),
  failedLoginAttempts: integer("failedLoginAttempts").default(0),
  lockedUntil: timestamp("lockedUntil"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const customerSessions = pgTable("customerSessions", {
  id: serial("id").primaryKey(),
  customerAccountId: integer("customerAccountId").references(() => customerAccounts.id, { onDelete: "cascade" }),
  sessionToken: text("sessionToken").notNull().unique(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const customerFavoriteServices = pgTable("customerFavoriteServices", {
  id: serial("id").primaryKey(),
  customerId: integer("customerId").references(() => customers.id, { onDelete: "cascade" }),
  serviceId: integer("serviceId").references(() => services.id, { onDelete: "cascade" }),
  addedAt: timestamp("addedAt").defaultNow(),
});

export const customerFavoriteEmployees = pgTable("customerFavoriteEmployees", {
  id: serial("id").primaryKey(),
  customerId: integer("customerId").references(() => customers.id, { onDelete: "cascade" }),
  employeeId: integer("employeeId").references(() => employees.id, { onDelete: "cascade" }),
  rating: integer("rating"),
  notes: text("notes"),
  addedAt: timestamp("addedAt").defaultNow(),
});

export const customerLoyaltyPoints = pgTable("customerLoyaltyPoints", {
  id: serial("id").primaryKey(),
  customerId: integer("customerId").references(() => customers.id, { onDelete: "cascade" }).unique(),
  currentPoints: integer("currentPoints").default(0),
  lifetimePoints: integer("lifetimePoints").default(0),
  tier: text("tier").default("bronze"), // 'bronze', 'silver', 'gold', 'platinum'
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const loyaltyPointTransactions = pgTable("loyaltyPointTransactions", {
  id: serial("id").primaryKey(),
  customerLoyaltyPointsId: integer("customerLoyaltyPointsId").references(() => customerLoyaltyPoints.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'earn', 'redeem', 'expire', 'adjustment'
  points: integer("points").notNull(),
  orderId: integer("orderId").references(() => orders.id),
  description: text("description"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const customerActivityLog = pgTable("customerActivityLog", {
  id: serial("id").primaryKey(),
  customerId: integer("customerId").references(() => customers.id, { onDelete: "cascade" }),
  activityType: text("activityType").notNull(), // 'login', 'booking', 'cancellation', 'profile_update', etc.
  description: text("description"),
  metadata: jsonb("metadata"),
  ipAddress: text("ipAddress"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const savedPaymentMethods = pgTable("savedPaymentMethods", {
  id: serial("id").primaryKey(),
  customerId: integer("customerId").references(() => customers.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'card', 'vipps', 'bank_account'
  provider: text("provider"), // 'stripe', 'vipps', 'nets'
  providerCustomerId: text("providerCustomerId"),
  providerPaymentMethodId: text("providerPaymentMethodId"),
  last4: text("last4"),
  brand: text("brand"),
  expiryMonth: integer("expiryMonth"),
  expiryYear: integer("expiryYear"),
  isDefault: boolean("isDefault").default(false),
  createdAt: timestamp("createdAt").defaultNow(),
});

// ==========================================
// PAYMENT EXTENSIONS TABLES
// ==========================================

export const paymentLinks = pgTable("paymentLinks", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  linkId: text("linkId").notNull().unique(),
  type: text("type").notNull(), // 'one_time', 'deposit', 'recurring', 'installment'
  amount: decimal("amount", { precision: 10, scale: 2 }),
  currency: text("currency").default("NOK"),
  description: text("description"),
  customerId: integer("customerId").references(() => customers.id),
  orderId: integer("orderId").references(() => orders.id),
  status: text("status").notNull().default("active"), // 'active', 'completed', 'expired', 'cancelled'
  expiresAt: timestamp("expiresAt"),
  maxUses: integer("maxUses"),
  usedCount: integer("usedCount").default(0),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const recurringSubscriptions = pgTable("recurringSubscriptions", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  customerId: integer("customerId").references(() => customers.id),
  paymentLinkId: integer("paymentLinkId").references(() => paymentLinks.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  interval: text("interval").notNull(), // 'daily', 'weekly', 'monthly', 'yearly'
  startDate: timestamp("startDate").notNull(),
  nextBillingDate: timestamp("nextBillingDate").notNull(),
  endDate: timestamp("endDate"),
  status: text("status").notNull().default("active"), // 'active', 'paused', 'cancelled', 'expired'
  paymentMethod: text("paymentMethod"),
  provider: text("provider"),
  providerSubscriptionId: text("providerSubscriptionId"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const installmentPlans = pgTable("installmentPlans", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  customerId: integer("customerId").references(() => customers.id),
  orderId: integer("orderId").references(() => orders.id),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  numberOfInstallments: integer("numberOfInstallments").notNull(),
  installmentAmount: decimal("installmentAmount", { precision: 10, scale: 2 }).notNull(),
  interval: text("interval").notNull(), // 'weekly', 'biweekly', 'monthly'
  startDate: timestamp("startDate").notNull(),
  status: text("status").notNull().default("active"), // 'active', 'completed', 'defaulted', 'cancelled'
  createdAt: timestamp("createdAt").defaultNow(),
});

export const installmentPayments = pgTable("installmentPayments", {
  id: serial("id").primaryKey(),
  installmentPlanId: integer("installmentPlanId").references(() => installmentPlans.id, { onDelete: "cascade" }),
  paymentId: integer("paymentId").references(() => payments.id),
  installmentNumber: integer("installmentNumber").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("dueDate").notNull(),
  paidAt: timestamp("paidAt"),
  status: text("status").notNull().default("pending"), // 'pending', 'paid', 'overdue', 'failed'
});

export const deposits = pgTable("deposits", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  customerId: integer("customerId").references(() => customers.id),
  appointmentId: integer("appointmentId").references(() => appointments.id),
  orderId: integer("orderId").references(() => orders.id),
  paymentId: integer("paymentId").references(() => payments.id),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  depositAmount: decimal("depositAmount", { precision: 10, scale: 2 }).notNull(),
  remainingAmount: decimal("remainingAmount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'paid', 'completed', 'refunded'
  dueDate: timestamp("dueDate"),
  createdAt: timestamp("createdAt").defaultNow(),
});

// ==========================================
// ACCOUNTING INTEGRATIONS TABLES
// ==========================================

export const accountingIntegrations = pgTable("accountingIntegrations", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull().unique(),
  provider: text("provider").notNull(), // 'fiken', 'tripletex', 'poweroffice', 'xledger'
  isActive: boolean("isActive").default(false),
  credentials: jsonb("credentials"), // Encrypted credentials
  settings: jsonb("settings"),
  lastSyncAt: timestamp("lastSyncAt"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const accountingSyncLog = pgTable("accountingSyncLog", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  provider: text("provider").notNull(),
  syncType: text("syncType").notNull(), // 'invoice', 'customer', 'payment', 'product'
  status: text("status").notNull(), // 'success', 'failed', 'partial'
  recordsProcessed: integer("recordsProcessed").default(0),
  recordsFailed: integer("recordsFailed").default(0),
  errorMessage: text("errorMessage"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});
// ==========================================
// SAAS MANAGEMENT TABLES
// Add these to your COMPLETE_SCHEMA.ts
// ==========================================

// Tenant Users (Admin/Manager accounts for each salon)
export const tenantUsers = pgTable("tenantUsers", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  passwordHash: text("passwordHash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("owner"), // 'super_admin', 'owner', 'manager'
  isActive: boolean("isActive").default(true),
  lastLoginAt: timestamp("lastLoginAt"),
  emailVerified: boolean("emailVerified").default(false),
  emailVerificationToken: text("emailVerificationToken"),
  passwordResetToken: text("passwordResetToken"),
  passwordResetExpires: timestamp("passwordResetExpires"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// User Sessions
export const userSessions = pgTable("userSessions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => tenantUsers.id, { onDelete: "cascade" }),
  sessionToken: text("sessionToken").notNull().unique(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Tenant Subscriptions
export const tenantSubscriptions = pgTable("tenantSubscriptions", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }).unique(),
  plan: text("plan").notNull(), // 'free', 'basic', 'professional', 'enterprise'
  status: text("status").notNull().default("active"), // 'active', 'cancelled', 'suspended', 'expired'
  billingCycle: text("billingCycle").notNull().default("monthly"), // 'monthly', 'yearly'
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("NOK"),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  nextBillingDate: timestamp("nextBillingDate"),
  autoRenew: boolean("autoRenew").default(true),
  trialEndsAt: timestamp("trialEndsAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Subscription Plans
export const subscriptionPlans = pgTable("subscriptionPlans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  monthlyPrice: decimal("monthlyPrice", { precision: 10, scale: 2 }).notNull(),
  yearlyPrice: decimal("yearlyPrice", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("NOK"),
  features: jsonb("features"), // Array of features
  limits: jsonb("limits"), // { maxEmployees: 10, maxBookings: 1000, etc }
  isActive: boolean("isActive").default(true),
  sortOrder: integer("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Tenant Invoices
export const tenantInvoices = pgTable("tenantInvoices", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull().references(() => tenants.id),
  subscriptionId: integer("subscriptionId").references(() => tenantSubscriptions.id),
  invoiceNumber: text("invoiceNumber").notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("NOK"),
  status: text("status").notNull().default("pending"), // 'pending', 'paid', 'overdue', 'cancelled'
  dueDate: timestamp("dueDate").notNull(),
  paidAt: timestamp("paidAt"),
  paymentMethod: text("paymentMethod"),
  paymentTransactionId: text("paymentTransactionId"),
  items: jsonb("items"), // Invoice line items
  createdAt: timestamp("createdAt").defaultNow(),
});

// Tenant Usage Tracking
export const tenantUsage = pgTable("tenantUsage", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull().references(() => tenants.id),
  period: text("period").notNull(), // 'YYYY-MM'
  bookingsCount: integer("bookingsCount").default(0),
  customersCount: integer("customersCount").default(0),
  employeesCount: integer("employeesCount").default(0),
  smsCount: integer("smsCount").default(0),
  emailCount: integer("emailCount").default(0),
  storageUsedMB: integer("storageUsedMB").default(0),
  apiCallsCount: integer("apiCallsCount").default(0),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Tenant Settings
export const tenantSettings = pgTable("tenantSettings", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }).unique(),
  businessName: text("businessName"),
  businessType: text("businessType"), // 'salon', 'spa', 'barbershop', etc
  logo: text("logo"),
  timezone: text("timezone").default("Europe/Oslo"),
  language: text("language").default("no"),
  currency: text("currency").default("NOK"),
  dateFormat: text("dateFormat").default("DD.MM.YYYY"),
  timeFormat: text("timeFormat").default("24h"),
  weekStartsOn: integer("weekStartsOn").default(1), // 0=Sunday, 1=Monday
  bookingSettings: jsonb("bookingSettings"),
  notificationSettings: jsonb("notificationSettings"),
  paymentSettings: jsonb("paymentSettings"),
  emailSettings: jsonb("emailSettings"),
  smsSettings: jsonb("smsSettings"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Audit Log
export const auditLog = pgTable("auditLog", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId"),
  userId: integer("userId").references(() => tenantUsers.id),
  action: text("action").notNull(), // 'create', 'update', 'delete', 'login', etc
  entityType: text("entityType"), // 'customer', 'booking', 'employee', etc
  entityId: integer("entityId"),
  changes: jsonb("changes"), // Before/after values
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow(),
});

// System Notifications
export const systemNotifications = pgTable("systemNotifications", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").references(() => tenants.id),
  userId: integer("userId").references(() => tenantUsers.id),
  type: text("type").notNull(), // 'info', 'warning', 'error', 'success'
  title: text("title").notNull(),
  message: text("message").notNull(),
  actionUrl: text("actionUrl"),
  isRead: boolean("isRead").default(false),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Feature Flags
export const featureFlags = pgTable("featureFlags", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").references(() => tenants.id),
  featureName: text("featureName").notNull(),
  isEnabled: boolean("isEnabled").default(false),
  config: jsonb("config"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Tenant Onboarding
export const tenantOnboarding = pgTable("tenantOnboarding", {
  id: serial("id").primaryKey(),
  tenantId: text("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }).unique(),
  currentStep: integer("currentStep").default(1),
  completedSteps: jsonb("completedSteps").default([]),
  isCompleted: boolean("isCompleted").default(false),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});
