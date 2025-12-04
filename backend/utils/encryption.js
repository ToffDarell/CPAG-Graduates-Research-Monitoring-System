import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

// Get encryption key from environment (32 bytes for AES-256)
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || (() => {
  console.warn("⚠️  WARNING: ENCRYPTION_KEY not set in .env. Using default (INSECURE). Generate a key and add to .env!");
  return crypto.randomBytes(32).toString("hex");
})();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Derive key from password using PBKDF2 (if needed)
 */
const getEncryptionKey = () => {
  // If ENCRYPTION_KEY is a hex string, convert it to buffer
  if (ENCRYPTION_KEY.length === 64) {
    // 64 hex chars = 32 bytes
    return Buffer.from(ENCRYPTION_KEY, "hex");
  }
  // Otherwise, derive key from the string
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
};

/**
 * Encrypt sensitive data
 */
export const encrypt = (text) => {
  try {
    if (!text) return null;

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const tag = cipher.getAuthTag();
    
    // Return: iv:tag:encrypted (all hex)
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
};

/**
 * Decrypt sensitive data
 */
export const decrypt = (encryptedData) => {
  try {
    if (!encryptedData) return null;

    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      // If format is wrong, might be unencrypted data (for migration)
      console.warn("Invalid encrypted data format, returning as-is (might be unencrypted)");
      return encryptedData;
    }

    const [ivHex, tagHex, encrypted] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    // If decryption fails, return original (might be unencrypted for migration)
    console.warn("Decryption failed, returning original value (might be unencrypted)");
    return encryptedData;
  }
};

/**
 * Encrypt OAuth tokens specifically
 */
export const encryptOAuthToken = (token) => {
  if (!token) return null;
  // Check if already encrypted (contains colons from our format)
  if (typeof token === "string" && token.includes(":") && token.split(":").length === 3) {
    return token; // Already encrypted
  }
  return encrypt(token);
};

/**
 * Decrypt OAuth tokens specifically
 */
export const decryptOAuthToken = (encryptedToken) => {
  if (!encryptedToken) return null;
  try {
    return decrypt(encryptedToken);
  } catch (error) {
    // If decryption fails, return as-is (might be unencrypted for migration)
    return encryptedToken;
  }
};

/**
 * Generate encryption key (for initial setup)
 */
export const generateEncryptionKey = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Check if data is encrypted
 */
export const isEncrypted = (data) => {
  if (!data || typeof data !== "string") return false;
  const parts = data.split(":");
  return parts.length === 3 && parts.every(part => /^[0-9a-f]+$/i.test(part));
};

