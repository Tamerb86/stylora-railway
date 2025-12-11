/**
 * Email Overage Billing API
 * 
 * Handles invoice generation and Stripe payment integration for email overages
 */

import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { tenants, emailOverageInvoices, emailUsageLogs } from "../../drizzle/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-11-20.acacia",
});

/**
 * Generate invoice number
 */
function generateInvoiceNumber(tenantId: string, date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const shortId = tenantId.substring(0, 8).toUpperCase();
  return `INV-${year}${month}-${shortId}`;
}

export const emailOverageBillingRouter = router({
  /**
   * Generate monthly invoice for email overages
   */
  generateMonthlyInvoice: adminProcedure
    .input(z.object({
      tenantId: z.string(),
      billingPeriodStart: z.string(), // ISO date
      billingPeriodEnd: z.string(), // ISO date
    }))
    .mutation(async ({ input }) => {
      const dbInstance = await getDb();
      if (!dbInstance) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const tenant = await dbInstance.query.tenants.findFirst({
        where: eq(tenants.id, input.tenantId),
      });

      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      }

      // Check if invoice already exists for this period
      const existingInvoice = await dbInstance.query.emailOverageInvoices.findFirst({
        where: and(
          eq(emailOverageInvoices.tenantId, input.tenantId),
          eq(emailOverageInvoices.billingPeriodStart, input.billingPeriodStart),
          eq(emailOverageInvoices.billingPeriodEnd, input.billingPeriodEnd)
        ),
      });

      if (existingInvoice) {
        throw new TRPCError({ code: "CONFLICT", message: "Invoice already exists for this period" });
      }

      // Calculate overage
      const emailsOverLimit = Math.max(0, (tenant.emailsSentThisMonth || 0) - (tenant.emailMonthlyLimit || 500));
      
      if (emailsOverLimit === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No overage to bill" });
      }

      const overageRate = parseFloat(tenant.emailOverageRate || "0.10");
      const subtotal = emailsOverLimit * overageRate;
      const vatRate = parseFloat(tenant.vatRate || "25.00");
      const vatAmount = (subtotal * vatRate) / 100;
      const totalAmount = subtotal + vatAmount;

      // Generate invoice number
      const invoiceNumber = generateInvoiceNumber(input.tenantId, new Date(input.billingPeriodEnd));

      // Calculate due date (30 days from invoice date)
      const dueDate = new Date(input.billingPeriodEnd);
      dueDate.setDate(dueDate.getDate() + 30);

      // Create invoice
      const [invoice] = await dbInstance.insert(emailOverageInvoices).values({
        tenantId: input.tenantId,
        invoiceNumber,
        billingPeriodStart: input.billingPeriodStart,
        billingPeriodEnd: input.billingPeriodEnd,
        emailsOverLimit,
        overageRate: overageRate.toFixed(2),
        subtotal: subtotal.toFixed(2),
        vatRate: vatRate.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        currency: tenant.currency || "NOK",
        status: "pending",
        dueDate: dueDate.toISOString().split('T')[0],
      }).$returningId();

      return {
        success: true,
        invoiceId: invoice.id,
        invoiceNumber,
        totalAmount: totalAmount.toFixed(2),
      };
    }),

  /**
   * Create Stripe invoice and payment intent
   */
  createStripeInvoice: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await dbInstance.query.emailOverageInvoices.findFirst({
        where: and(
          eq(emailOverageInvoices.id, input.invoiceId),
          eq(emailOverageInvoices.tenantId, ctx.user.tenantId)
        ),
      });

      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }

      if (invoice.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice is not pending" });
      }

      const tenant = await dbInstance.query.tenants.findFirst({
        where: eq(tenants.id, ctx.user.tenantId),
      });

      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      }

      // Create or get Stripe customer
      let stripeCustomerId = tenant.stripeCustomerId;
      
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: tenant.email || undefined,
          name: tenant.name,
          metadata: {
            tenantId: tenant.id,
          },
        });
        
        stripeCustomerId = customer.id;
        
        // Update tenant with Stripe customer ID
        await dbInstance.update(tenants)
          .set({ stripeCustomerId })
          .where(eq(tenants.id, ctx.user.tenantId));
      }

      // Create Stripe invoice
      const stripeInvoice = await stripe.invoices.create({
        customer: stripeCustomerId,
        collection_method: 'send_invoice',
        days_until_due: 30,
        description: `Email overage charges for ${invoice.billingPeriodStart} to ${invoice.billingPeriodEnd}`,
        metadata: {
          tenantId: ctx.user.tenantId,
          invoiceId: input.invoiceId.toString(),
          invoiceNumber: invoice.invoiceNumber,
        },
      });

      // Add invoice item
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        invoice: stripeInvoice.id,
        amount: Math.round(parseFloat(invoice.totalAmount) * 100), // Convert to cents
        currency: invoice.currency.toLowerCase(),
        description: `${invoice.emailsOverLimit} emails over limit @ ${invoice.overageRate} ${invoice.currency} each`,
      });

      // Finalize and send invoice
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(stripeInvoice.id);

      // Update our invoice with Stripe IDs
      await dbInstance.update(emailOverageInvoices)
        .set({
          stripeInvoiceId: stripeInvoice.id,
        })
        .where(eq(emailOverageInvoices.id, input.invoiceId));

      return {
        success: true,
        stripeInvoiceId: stripeInvoice.id,
        hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url,
      };
    }),

  /**
   * Get all invoices for current tenant
   */
  getInvoices: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const invoices = await dbInstance.query.emailOverageInvoices.findMany({
        where: eq(emailOverageInvoices.tenantId, ctx.user.tenantId),
        orderBy: [desc(emailOverageInvoices.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      const total = await dbInstance.select({ count: sql<number>`count(*)` })
        .from(emailOverageInvoices)
        .where(eq(emailOverageInvoices.tenantId, ctx.user.tenantId));

      return {
        invoices: invoices.map(inv => ({
          ...inv,
          subtotal: parseFloat(inv.subtotal),
          vatAmount: parseFloat(inv.vatAmount),
          totalAmount: parseFloat(inv.totalAmount),
          overageRate: parseFloat(inv.overageRate),
        })),
        total: total[0]?.count || 0,
      };
    }),

  /**
   * Get single invoice details
   */
  getInvoice: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const invoice = await dbInstance.query.emailOverageInvoices.findFirst({
        where: and(
          eq(emailOverageInvoices.id, input.invoiceId),
          eq(emailOverageInvoices.tenantId, ctx.user.tenantId)
        ),
      });

      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }

      return {
        ...invoice,
        subtotal: parseFloat(invoice.subtotal),
        vatAmount: parseFloat(invoice.vatAmount),
        totalAmount: parseFloat(invoice.totalAmount),
        overageRate: parseFloat(invoice.overageRate),
      };
    }),

  /**
   * Admin: Get all invoices across all tenants
   */
  getAllInvoices: adminProcedure
    .input(z.object({
      status: z.enum(["pending", "paid", "failed", "cancelled"]).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const conditions = input.status 
        ? eq(emailOverageInvoices.status, input.status)
        : undefined;

      const invoices = await dbInstance.query.emailOverageInvoices.findMany({
        where: conditions,
        orderBy: [desc(emailOverageInvoices.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      return invoices.map(inv => ({
        ...inv,
        subtotal: parseFloat(inv.subtotal),
        vatAmount: parseFloat(inv.vatAmount),
        totalAmount: parseFloat(inv.totalAmount),
        overageRate: parseFloat(inv.overageRate),
      }));
    }),

  /**
   * Handle Stripe webhook for invoice payment
   */
  handleStripeWebhook: adminProcedure
    .input(z.object({
      stripeInvoiceId: z.string(),
      status: z.enum(["paid", "failed"]),
      paidAt: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const dbInstance = await getDb();
      if (!dbInstance) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const invoice = await dbInstance.query.emailOverageInvoices.findFirst({
        where: eq(emailOverageInvoices.stripeInvoiceId, input.stripeInvoiceId),
      });

      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }

      await dbInstance.update(emailOverageInvoices)
        .set({
          status: input.status,
          paidAt: input.paidAt ? new Date(input.paidAt) : null,
        })
        .where(eq(emailOverageInvoices.id, invoice.id));

      // If paid, reset overage charge for tenant
      if (input.status === "paid") {
        await dbInstance.update(tenants)
          .set({
            emailOverageCharge: "0.00",
          })
          .where(eq(tenants.id, invoice.tenantId));
      }

      return { success: true };
    }),
});
