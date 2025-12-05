import crypto from "crypto";

const key = crypto.randomBytes(32).toString("hex");

console.log("\n" + "=".repeat(60));
console.log("ENCRYPTION KEY GENERATED");
console.log("=".repeat(60));
console.log("\nAdd this to your .env file:");
console.log(`ENCRYPTION_KEY=${key}`);
console.log("\n" + "=".repeat(60));
console.log("\n⚠️  IMPORTANT:");
console.log("1. Keep this key SECRET and secure");
console.log("2. Do NOT commit it to version control");
console.log("3. Back up this key separately - if lost, encrypted data cannot be decrypted");
console.log("4. Add it to your .env file immediately");
console.log("\n" + "=".repeat(60) + "\n");



