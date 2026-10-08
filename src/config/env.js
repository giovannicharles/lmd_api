import dotenv from "dotenv";

dotenv.config();

const required = ["DATABASE_URL", "JWT_SECRET"];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

if (process.env.NODE_ENV === "production") {
  const secret = process.env.JWT_SECRET || "";
  const weak = secret.length < 32 || /changeme|change_me|secret|password|123456/i.test(secret);
  if (weak) {
    console.error("JWT_SECRET trop faible pour la production : utilisez au moins 32 caracteres aleatoires.");
    process.exit(1);
  }
}

export const env = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === "true",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  publicUrl: (process.env.PUBLIC_URL || "").replace(/\/+$/, ""),
  publicSiteUrl: (process.env.PUBLIC_SITE_URL || "").replace(/[/]+$/, ""),
  frontendDist: process.env.FRONTEND_DIST || "",
  frontendUrl: (process.env.FRONTEND_URL || "").replace(/[/]+$/, ""),
  whatsappNumber: process.env.WHATSAPP_NUMBER || "",
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  },
};
