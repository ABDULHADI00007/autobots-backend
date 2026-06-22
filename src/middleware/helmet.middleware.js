import helmet from "helmet";

// ============================================================
// HELMET SECURITY MIDDLEWARE CONFIGURATION
// ============================================================
// Helmet helps secure Express apps by setting HTTP response headers

export const helmetConfig = helmet({
  contentSecurityPolicy: false, // Disabled to avoid conflicts with other middleware
  frameguard: {
    action: "deny", // Prevent clickjacking attacks
  },
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin",
  },
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true,
  },
  xssFilter: true,
  noSniff: true, // Prevent MIME-sniffing
  originAgentCluster: true,
});
