/**
 * SMS Packages Management API
 * 
 * Handles SMS package selection, usage tracking, and overage calculation
 */

import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { tenants, smsPackages, smsUsageLogs } from "../../drizzle/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const smsPackagesRouter = router({
  /**
   * Get all available SMS packages
   */
  getPackages: protectedProcedure.query(async () => {
    const dbInstance = await getDb();
    if (!dbInstance) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }

    const packages = await dbInstance.query.smsPackages.findMany({
      where: eq(smsPackages.isActive, true),
      orderBy: [smsPackages.packageSize],
    });

    return packages.map(pkg => ({
      ...pkg,
      pricePerSms: parseFloat(pkg.pricePerSms),
      monthlyPrice: parseFloat(pkg.monthlyPrice),
    }));
  }),

  /**
   * Get current SMS usage for tenant
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
          smsSentThisMonth: 0,
          smsOverageCharge: "0.00",
          currentMonthStart: new Date(now.getFullYear(), now.getMonth(), 1),
        })
        .where(eq(tenants.id, ctx.user.tenantId));

      return {
        packageSize: tenant.smsPackageSize || 0,
        packagePrice: parseFloat(tenant.smsPackagePrice || "0.00"),
        packageActive: tenant.smsPackageActive || false,
        used: 0,
        remaining: tenant.smsPackageSize || 0,
        overageCount: 0,
        overageCharge: 0,
        overageRate: parseFloat(tenant.smsOverageRate || "1.00"),
        percentUsed: 0,
      };
    }

    const used = tenant.smsSentThisMonth || 0;
    const packageSize = tenant.smsPackageSize || 0;
    const remaining = Math.max(0, packageSize - used);
    const overageCount = Math.max(0, used - packageSize);
    const overageCharge = parseFloat(tenant.smsOverageCharge || "0.00");
    const overageRate = parseFloat(tenant.smsOverageRate || "1.00");
    const percentUsed = packageSize > 0 ? Math.round((used / packageSize) * 100) : 0;

    return {
      packageSize,
      packagePrice: parseFloat(tenant.smsPackagePrice || "0.00"),
      packageActive: tenant.smsPackageActive || false,
      used,
      remaining,
      overageCount,
      overageCharge,
      overageRate,
      percentUsed,
    };
  }),

  /**
   * Select or update SMS package
   */
  selectPackage: protectedProcedure
    .input(z.object({
      packageSize: z.number().min(0).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await getDb();
      if (!dbInstance) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // If packageSize is 0, deactivate SMS package
      if (input.packageSize === 0) {
        await dbInstance.update(tenants)
          .set({
            smsPackageSize: 0,
            smsPackagePrice: "0.00",
            smsPackageActive: false,
          })
          .where(eq(tenants.id, ctx.user.tenantId));

        return { success: true, message: "SMS pakke deaktivert" };
      }

      // Find the package
      const pkg = await dbInstance.query.smsPackages.findFirst({
        where: and(
          eq(smsPackages.packageSize, input.packageSize),
          eq(smsPackages.isActive, true)
        ),
      });

      if (!pkg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
      }

      // Update tenant with new package
      await dbInstance.update(tenants)
        .set({
          smsPackageSize: pkg.packageSize,
          smsPackagePrice: pkg.monthlyPrice,
          smsPackageActive: true,
        })
        .where(eq(tenants.id, ctx.user.tenantId));

      return { 
        success: true, 
        message: `SMS pakke oppdatert til ${pkg.displayName}`,
        packageSize: pkg.packageSize,
        monthlyPrice: parseFloat(pkg.monthlyPrice),
      };
    }),

  /**
   * Track SMS send (called before sending SMS)
   */
  trackSmsSend: protectedProcedure
    .input(z.object({
      smsType: z.string(),
      recipientPhone: z.string(),
      message: z.string().optional(),
      provider: z.string().optional(),
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

      // Check if SMS package is active
      if (!tenant.smsPackageActive) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "SMS pakke er ikke aktiv. Vennligst velg en pakke først." 
        });
      }

      const used = (tenant.smsSentThisMonth || 0) + 1;
      const packageSize = tenant.smsPackageSize || 0;
      const isOverage = used > packageSize;
      const overageRate = parseFloat(tenant.smsOverageRate || "1.00");
      const overageCost = isOverage ? overageRate : 0;
      const totalOverageCharge = parseFloat(tenant.smsOverageCharge || "0.00") + overageCost;

      // Update tenant counter
      await dbInstance.update(tenants)
        .set({
          smsSentThisMonth: used,
          smsOverageCharge: totalOverageCharge.toFixed(2),
        })
        .where(eq(tenants.id, ctx.user.tenantId));

      // Log the SMS send
      await dbInstance.insert(smsUsageLogs).values({
        tenantId: ctx.user.tenantId,
        smsType: input.smsType,
        recipientPhone: input.recipientPhone,
        message: input.message || "",
        status: "sent",
        isOverage,
        overageCost: overageCost.toFixed(2),
        provider: input.provider || "default",
      });

      return {
        success: true,
        isOverage,
        overageCost,
        totalUsed: used,
        remaining: Math.max(0, packageSize - used),
      };
    }),

  /**
   * Get SMS usage history
   */
  getUsageHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await getDb();
      if (!dbInstance) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const logs = await dbInstance.query.smsUsageLogs.findMany({
        where: eq(smsUsageLogs.tenantId, ctx.user.tenantId),
        orderBy: [desc(smsUsageLogs.sentAt)],
        limit: input.limit,
        offset: input.offset,
      });

      const total = await dbInstance.select({ count: sql<number>`count(*)` })
        .from(smsUsageLogs)
        .where(eq(smsUsageLogs.tenantId, ctx.user.tenantId));

      return {
        logs,
        total: total[0]?.count || 0,
      };
    }),

  /**
   * Admin: Get all tenants with SMS usage stats
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
        smsPackageSize: true,
        smsPackagePrice: true,
        smsPackageActive: true,
        smsSentThisMonth: true,
        smsOverageCharge: true,
        currentMonthStart: true,
      },
    });

    return allTenants.map(tenant => ({
      ...tenant,
      smsPackagePrice: parseFloat(tenant.smsPackagePrice || "0.00"),
      smsOverageCharge: parseFloat(tenant.smsOverageCharge || "0.00"),
      percentUsed: tenant.smsPackageSize 
        ? Math.round(((tenant.smsSentThisMonth || 0) / tenant.smsPackageSize) * 100)
        : 0,
    }));
  }),

  /**
   * Admin: Update custom SMS package for a tenant
   */
  updateCustomPackage: adminProcedure
    .input(z.object({
      tenantId: z.string(),
      packageSize: z.number().min(0),
      packagePrice: z.number().min(0),
      overageRate: z.number().min(0),
    }))
    .mutation(async ({ input }) => {
      const dbInstance = await getDb();
      if (!dbInstance) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      await dbInstance.update(tenants)
        .set({
          smsPackageSize: input.packageSize,
          smsPackagePrice: input.packagePrice.toFixed(2),
          smsOverageRate: input.overageRate.toFixed(2),
          smsPackageActive: input.packageSize > 0,
        })
        .where(eq(tenants.id, input.tenantId));

      return { success: true };
    }),
});
