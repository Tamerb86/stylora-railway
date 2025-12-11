// ==========================================
// tRPC SETUP WITH CONTEXT
// ==========================================

import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { db } from "./db";
import * as schema from "./schema";
import { eq } from "drizzle-orm";

// ==========================================
// CREATE CONTEXT
// ==========================================

export const createContext = async ({ req, res }: CreateExpressContextOptions) => {
  return {
    req,
    res,
    user: null as any,
    session: null as any,
    tenantId: null as string | null,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

// ==========================================
// INITIALIZE tRPC
// ==========================================

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================

export const isAuthenticated = middleware(async ({ ctx, next }) => {
  const sessionToken = ctx.req?.headers?.authorization?.replace("Bearer ", "");
  
  if (!sessionToken) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "No session token provided",
    });
  }

  // Verify session in database
  const [session] = await db.select()
    .from(schema.userSessions)
    .where(eq(schema.userSessions.sessionToken, sessionToken));

  if (!session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid session token",
    });
  }

  // Check if session expired
  if (new Date() > session.expiresAt) {
    // Delete expired session
    await db.delete(schema.userSessions)
      .where(eq(schema.userSessions.id, session.id));
    
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Session expired",
    });
  }

  // Get user details
  const [user] = await db.select()
    .from(schema.tenantUsers)
    .where(eq(schema.tenantUsers.id, session.userId));

  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not found",
    });
  }

  // Pass user and session to context
  return next({
    ctx: {
      ...ctx,
      user,
      session,
      tenantId: user.tenantId,
    },
  });
});

// ==========================================
// PROTECTED PROCEDURE
// ==========================================

export const protectedProcedure = publicProcedure.use(isAuthenticated);

// ==========================================
// TENANT ISOLATION MIDDLEWARE
// ==========================================

export const checkTenantAccess = middleware(async ({ ctx, input, next }) => {
  // @ts-ignore - input will have tenantId
  const requestedTenantId = input?.tenantId;
  const userTenantId = ctx.tenantId;

  if (!requestedTenantId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "tenantId is required",
    });
  }

  if (requestedTenantId !== userTenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied to this tenant's data",
    });
  }

  return next();
});

// ==========================================
// TENANT PROCEDURE
// ==========================================

export const tenantProcedure = protectedProcedure.use(checkTenantAccess);

// ==========================================
// ROLE-BASED ACCESS CONTROL
// ==========================================

export const requireRole = (allowedRoles: string[]) => {
  return middleware(async ({ ctx, next }) => {
    const userRole = ctx.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
      });
    }

    return next();
  });
};

// ==========================================
// ADMIN PROCEDURE
// ==========================================

export const adminProcedure = protectedProcedure.use(
  requireRole(["super_admin", "admin"])
);

// ==========================================
// MANAGER PROCEDURE
// ==========================================

export const managerProcedure = protectedProcedure.use(
  requireRole(["super_admin", "admin", "owner", "manager"])
);

// ==========================================
// RATE LIMITING MIDDLEWARE
// ==========================================

// In-memory rate limiter (for production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = (maxRequests: number, windowMs: number) => {
  return middleware(async ({ ctx, next }) => {
    const identifier = ctx.user?.id?.toString() || ctx.req?.ip || "anonymous";
    const now = Date.now();
    
    const record = rateLimitMap.get(identifier);
    
    if (record) {
      if (now < record.resetAt) {
        if (record.count >= maxRequests) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Rate limit exceeded. Please try again later.",
          });
        }
        record.count++;
      } else {
        // Reset window
        rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
      }
    } else {
      rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    }

    return next();
  });
};

// ==========================================
// RATE LIMITED PROCEDURE
// ==========================================

export const rateLimitedProcedure = protectedProcedure.use(
  rateLimit(100, 15 * 60 * 1000) // 100 requests per 15 minutes
);

// ==========================================
// AUDIT LOGGING MIDDLEWARE
// ==========================================

export const auditLog = middleware(async ({ ctx, input, next, path }) => {
  const startTime = Date.now();
  
  try {
    const result = await next();
    
    // Log successful operation
    await db.insert(schema.auditLog).values({
      tenantId: ctx.tenantId,
      userId: ctx.user?.id,
      action: path,
      entityType: path.split(".")[0],
      // @ts-ignore
      entityId: input?.id || null,
      changes: { input },
      ipAddress: ctx.req?.ip,
      userAgent: ctx.req?.headers?.["user-agent"],
      duration: Date.now() - startTime,
      createdAt: new Date(),
    });

    return result;
  } catch (error: any) {
    // Log failed operation
    await db.insert(schema.auditLog).values({
      tenantId: ctx.tenantId,
      userId: ctx.user?.id,
      action: path,
      entityType: path.split(".")[0],
      changes: { input, error: error.message },
      ipAddress: ctx.req?.ip,
      userAgent: ctx.req?.headers?.["user-agent"],
      duration: Date.now() - startTime,
      createdAt: new Date(),
    });

    throw error;
  }
});

// ==========================================
// AUDITED PROCEDURE
// ==========================================

export const auditedProcedure = protectedProcedure.use(auditLog);

// ==========================================
// SECURITY EVENT LOGGING
// ==========================================

export const logSecurityEvent = async (event: {
  type: string;
  userId?: number;
  tenantId?: string;
  ip?: string;
  userAgent?: string;
  details?: any;
  severity: "low" | "medium" | "high" | "critical";
}) => {
  await db.insert(schema.securityLog).values({
    eventType: event.type,
    userId: event.userId,
    tenantId: event.tenantId,
    ipAddress: event.ip,
    userAgent: event.userAgent,
    details: event.details,
    severity: event.severity,
    createdAt: new Date(),
  });

  // Send alert if critical
  if (event.severity === "critical") {
    console.error("CRITICAL SECURITY EVENT:", event);
    // TODO: Send email/SMS to admins
  }
};

// ==========================================
// EXPORTS
// ==========================================

export default {
  router,
  publicProcedure,
  protectedProcedure,
  tenantProcedure,
  adminProcedure,
  managerProcedure,
  rateLimitedProcedure,
  auditedProcedure,
  middleware,
  logSecurityEvent,
};
