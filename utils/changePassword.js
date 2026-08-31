import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const uid = process.env.TARGET_AUTH_UID;
const password = process.env.TARGET_AUTH_PASSWORD;

async function main() {
  if (!uid || !password) {
    throw new Error(
      "Set TARGET_AUTH_UID and TARGET_AUTH_PASSWORD before running this script.",
    );
  }

  const { getAdminAuth } = await import("../lib/firebase-admin.js");
  const adminAuth = getAdminAuth();

  adminAuth
    .updateUser(uid, { password })
    .then(() => {
      console.log("✅ Password updated successfully");
      process.exit();
    })
    .catch((err) => {
      console.error("❌ Error updating password:", err);
    });
}

main();
