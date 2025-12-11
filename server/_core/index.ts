// ==========================================
// EXPRESS SERVER WITH SECURITY
// ==========================================

import express from "express";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./trpc";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

const app = express();

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});

// ==========================================
// CORS
// ==========================================

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ==========================================
// RATE LIMITING
// ==========================================

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: "Too many login attempts, please try again later",
  skipSuccessfulRequests: true,
});

app.use("/api", globalLimiter);

// ==========================================
// BODY PARSER
// ==========================================

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ==========================================
// REQUEST LOGGING
// ==========================================

if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// ==========================================
// API INFO
// ==========================================

app.get("/api", (req, res) => {
  res.json({
    name: "Stylora API",
    version: "2.0.0",
    description: "Multi-tenant salon management system",
    endpoints: {
      health: "/health",
      api: "/api/*",
    },
  });
});

// ==========================================
// tRPC MIDDLEWARE
// ==========================================

app.use(
  "/api/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
    onError: ({ path, error }) => {
      console.error(`❌ tRPC Error on ${path}:`, error);
      
      // Log to security log if it's an auth error
      if (error.code === "UNAUTHORIZED" || error.code === "FORBIDDEN") {
        // TODO: Log to security_log table
      }
    },
  })
);

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("❌ Global Error:", err);
  
  // Don't leak error details in production
  if (process.env.NODE_ENV === "production") {
    res.status(500).json({
      error: "Internal Server Error",
      message: "Something went wrong",
    });
  } else {
    res.status(500).json({
      error: err.name || "Internal Server Error",
      message: err.message,
      stack: err.stack,
    });
  }
});

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════╗
║                                        ║
║   🚀 Stylora Server Running            ║
║                                        ║
║   Environment: ${process.env.NODE_ENV || "development".padEnd(20)}║
║   Port: ${PORT.toString().padEnd(30)}║
║   Host: ${HOST.padEnd(30)}║
║                                        ║
║   Health: http://localhost:${PORT}/health     ║
║   API: http://localhost:${PORT}/api/trpc      ║
║                                        ║
╚════════════════════════════════════════╝
  `);
});

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================

process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  process.exit(0);
});

// ==========================================
// UNHANDLED ERRORS
// ==========================================

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // TODO: Send to error tracking service (Sentry, etc.)
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // TODO: Send to error tracking service (Sentry, etc.)
  process.exit(1);
});

export default app;
