/**
 * Stripe Webhook Handler
 * 
 * Handles Stripe webhook events for automatic invoice status updates
 */

import Stripe from "stripe";
import { getDb } from "../db";
import { emailOverageInvoices, smsOverageInvoices } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-11-20.acacia",
});

/**
 * Verify Stripe webhook signature
 */
export function verifyStripeWebhook(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Handle invoice.payment_succeeded event
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const dbInstance = await getDb();
  if (!dbInstance) {
    throw new Error("Database not available");
  }

  const stripeInvoiceId = invoice.id;
  const paidAt = new Date(invoice.status_transition.paid_at! * 1000);

  // Try to find email overage invoice
  const [emailInvoice] = await dbInstance
    .select()
    .from(emailOverageInvoices)
    .where(eq(emailOverageInvoices.stripeInvoiceId, stripeInvoiceId))
    .limit(1);

  if (emailInvoice) {
    // Update email overage invoice status
    await dbInstance
      .update(emailOverageInvoices)
      .set({
        status: "paid",
        paidAt,
        stripePaymentIntentId: invoice.payment_intent as string || null,
      })
      .where(eq(emailOverageInvoices.id, emailInvoice.id));

    console.log(`✅ Email overage invoice ${emailInvoice.invoiceNumber} marked as paid`);
    return { type: "email", invoiceNumber: emailInvoice.invoiceNumber };
  }

  // Try to find SMS overage invoice
  const [smsInvoice] = await dbInstance
    .select()
    .from(smsOverageInvoices)
    .where(eq(smsOverageInvoices.stripeInvoiceId, stripeInvoiceId))
    .limit(1);

  if (smsInvoice) {
    // Update SMS overage invoice status
    await dbInstance
      .update(smsOverageInvoices)
      .set({
        status: "paid",
        paidAt,
      })
      .where(eq(smsOverageInvoices.id, smsInvoice.id));

    console.log(`✅ SMS overage invoice ${smsInvoice.invoiceNumber} marked as paid`);
    return { type: "sms", invoiceNumber: smsInvoice.invoiceNumber };
  }

  console.warn(`⚠️ No invoice found for Stripe invoice ${stripeInvoiceId}`);
  return null;
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const dbInstance = await getDb();
  if (!dbInstance) {
    throw new Error("Database not available");
  }

  const stripeInvoiceId = invoice.id;

  // Try to find email overage invoice
  const [emailInvoice] = await dbInstance
    .select()
    .from(emailOverageInvoices)
    .where(eq(emailOverageInvoices.stripeInvoiceId, stripeInvoiceId))
    .limit(1);

  if (emailInvoice) {
    // Update email overage invoice status
    await dbInstance
      .update(emailOverageInvoices)
      .set({
        status: "failed",
      })
      .where(eq(emailOverageInvoices.id, emailInvoice.id));

    console.log(`❌ Email overage invoice ${emailInvoice.invoiceNumber} marked as failed`);
    return { type: "email", invoiceNumber: emailInvoice.invoiceNumber };
  }

  // Try to find SMS overage invoice
  const [smsInvoice] = await dbInstance
    .select()
    .from(smsOverageInvoices)
    .where(eq(smsOverageInvoices.stripeInvoiceId, stripeInvoiceId))
    .limit(1);

  if (smsInvoice) {
    // Update SMS overage invoice status
    await dbInstance
      .update(smsOverageInvoices)
      .set({
        status: "failed",
      })
      .where(eq(smsOverageInvoices.id, smsInvoice.id));

    console.log(`❌ SMS overage invoice ${smsInvoice.invoiceNumber} marked as failed`);
    return { type: "sms", invoiceNumber: smsInvoice.invoiceNumber };
  }

  console.warn(`⚠️ No invoice found for Stripe invoice ${stripeInvoiceId}`);
  return null;
}

/**
 * Main webhook event handler
 */
export async function handleStripeWebhook(event: Stripe.Event) {
  console.log(`📨 Received Stripe webhook: ${event.type}`);

  try {
    switch (event.type) {
      case "invoice.payment_succeeded":
        return await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);

      case "invoice.payment_failed":
        return await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        // Handle subscription events if needed in the future
        console.log(`ℹ️ Subscription event received: ${event.type}`);
        return { type: "subscription", event: event.type };

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
        return null;
    }
  } catch (error) {
    console.error(`❌ Error handling webhook event ${event.type}:`, error);
    throw error;
  }
}
