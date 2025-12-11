/**
 * Email Limits Management API
 * 
 * Handles email quota tracking, overage calculation, and subscription management
 */

import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { tenants, subscriptionPlans, emailUsageLogs } from "../../drizzle/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const emailLimitsRouter = router({
  /**
   * Get current email usage for tenant
   */
  getUsage: protectedProcedure.query(async ({ ctx }) => {
    const dbInstance = await getDb();
    if (!dbInstance) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }

    const tenant = await dbInstance.query.tenants.findFirst({
      where: eq(tenants.id, ctx.user.tenantId),
    });

    if (!tenant) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
    }

    // Check if we need to reset monthly counter
    const now = new Date();
    const currentMonthStart = tenant.currentMonthStart ? new Date(tenant.currentMonthStart) : null;
    
    let needsReset = false;
    if (!currentMonthStart) {
      needsReset = true;
    } else {
      const monthsDiff = (now.getFullYear() - currentMonthStart.getFullYear()) * 12 + 
                        (now.getMonth() - currentMonthStart.getMonth());
      if (monthsDiff >= 1) {
        needsReset = true;
      }
    }

    if (needsReset) {
      // Reset monthly counter
      await dbInstance.update(tenants)
        .set({
          emailsSentThisMonth: 0,
          emailOverageCharge: "0.00",
          currentMonthStart: new Date(now.getFullYear(), now.getMonth(), 1),
        })
        .where(eq(tenants.id, ctx.user.tenantId));

      return {
        limit: tenant.emailMonthlyLimit || 500,
        used: 0,
        remaining: tenant.emailMonthlyLimit || 500,
        overageCount: 0,
        overageCharge: 0,
        overageRate: parseFloat(tenant.emailOverageRate || "0.10"),
        subscriptionPlan: tenant.subscriptionPlan || "basic",
        percentUsed: 0,
      };
    }

    const used = tenant.emailsSentThisMonth || 0;
    const limit = tenant.emailMonthlyLimit || 500;
    const remaining = Math.max(0, limit - used);
    const overageCount = Math.max(0, used - limit);
    const overageCharge = parseFloat(tenant.emailOverageCharge || "0.00");
    const overageRate = parseFloat(tenant.emailOverageRate || "0.10");
    const percentUsed = limit > 0 ? Math.round((used / limit) * 100) : 0;

    return {
      limit,
      used,
      remaining,
      overageCount,
      overageCharge,
      overageRate,
      subscriptionPlan: tenant.subscriptionPlan || "basic",
      percentUsed,
    };
  }),

  /**
   * Track email send (called before sending email)
   */
  trackEmailSend: protectedProcedure
    .input(z.object({
      emailType: z.string(),
      recipientEmail: z.string().email(),
      subject: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await getDb();
      if (!dbInstance) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const tenant = await dbInstance.query.tenants.findFirst({
        where: eq(tenants.id, ctx.user.tenantId),
      });

      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      }

      const used = (tenant.emailsSentThisMonth || 0) + 1;
      const limit = tenant.emailMonthlyLimit || 500;
      const isOverage = used > limit;
      const overageRate = parseFloat(tenant.emailOverageRate || "0.10");
      const overageCost = isOverage ? overageRate : 0;
      const totalOverageCharge = parseFloat(tenant.emailOverageCharge || "0.00") + overageCost;

      // Update tenant counter
      await dbInstance.update(tenants)
        .set({
          emailsSentThisMonth: used,
          emailOverageCharge: totalOverageCharge.toFixed(2),
        })
        .where(eq(tenants.id, ctx.user.tenantId));

      // Log the email send
      await dbInstance.insert(emailUsageLogs).values({
        tenantId: ctx.user.tenantId,
        emailType: input.emailType,
        recipientEmail: input.recipientEmail,
        subject: input.subject || "",
        status: "sent",
        isOverage,
        overageCost: overageCost.toFixed(2),
      });

      return {
        success: true,
        isOverage,
        overageCost,
        totalUsed: used,
        remaining: Math.max(0, limit - used),
      };
    }),

  /**
   * Get email usage history
   */
  getUsageHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const logs = await dbInstance.query.emailUsageLogs.findMany({
        where: eq(emailUsageLogs.tenantId, ctx.user.tenantId),
        orderBy: [desc(emailUsageLogs.sentAt)],
        limit: input.limit,
        offset: input.offset,
      });

      const total = await dbInstance.select({ count: sql<number>`count(*)` })
        .from(emailUsageLogs)
        .where(eq(emailUsageLogs.tenantId, ctx.user.tenantId));

      return {
        logs,
        total: total[0]?.count || 0,
      };
    }),

  /**
   * Get available subscription plans
   */
  getPlans: protectedProcedure.query(async () => {
    const dbInstance = await getDb();
    if (!dbInstance) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }

    const plans = await dbInstance.query.subscriptionPlans.findMany({
      where: eq(subscriptionPlans.isActive, true),
    });

    return plans.map(plan => ({
      ...plan,
      emailOverageRate: parseFloat(plan.emailOverageRate),
      monthlyPrice: parseFloat(plan.monthlyPrice),
    }));
  }),

  /**
   * Admin: Update tenant subscription plan
   */
  updateTenantPlan: adminProcedure
    .input(z.object({
      tenantId: z.string(),
      planName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const plan = await dbInstance.query.subscriptionPlans.findFirst({
        where: and(
          eq(subscriptionPlans.planName, input.planName),
          eq(subscriptionPlans.isActive, true)
        ),
      });

      if (!plan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      }

      await dbInstance.update(tenants)
        .set({
          subscriptionPlan: plan.planName,
          emailMonthlyLimit: plan.emailMonthlyLimit,
          emailOverageRate: plan.emailOverageRate,
        })
        .where(eq(tenants.id, input.tenantId));

      return { success: true };
    }),

  /**
   * Admin: Get all tenants with email usage stats
   */
  getAllTenantsUsage: adminProcedure.query(async () => {
    const dbInstance = await getDb();
    if (!dbInstance) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }

    const allTenants = await dbInstance.query.tenants.findMany({
      columns: {
        id: true,
        name: true,
        subscriptionPlan: true,
        emailMonthlyLimit: true,
        emailsSentThisMonth: true,
        emailOverageCharge: true,
        currentMonthStart: true,
      },
    });

    return allTenants.map(tenant => ({
      ...tenant,
      emailOverageCharge: parseFloat(tenant.emailOverageCharge || "0.00"),
      percentUsed: tenant.emailMonthlyLimit 
        ? Math.round(((tenant.emailsSentThisMonth || 0) / tenant.emailMonthlyLimit) * 100)
        : 0,
    }));
  }),

  /**
   * Admin: Update custom email limit for a tenant
   */
  updateCustomLimit: adminProcedure
    .input(z.object({
      tenantId: z.string(),
      emailMonthlyLimit: z.number().min(0),
      emailOverageRate: z.number().min(0),
    }))
    .mutation(async ({ input }) => {
      await dbInstance.update(tenants)
        .set({
          emailMonthlyLimit: input.emailMonthlyLimit,
          emailOverageRate: input.emailOverageRate.toFixed(2),
        })
        .where(eq(tenants.id, input.tenantId));

      return { success: true };
    }),
});
