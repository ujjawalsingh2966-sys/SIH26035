import dotenv from "dotenv";
dotenv.config();

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
) {
  throw new Error("Production requires a JWT_SECRET of at least 32 characters");
}

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "dev-safe-secret-do-not-use-in-prod",
  clientUrl: process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",")
    : ["http://localhost:3000", "http://localhost:3001"],
  publicWebUrl: process.env.PUBLIC_WEB_URL || "http://localhost:3000",
};
