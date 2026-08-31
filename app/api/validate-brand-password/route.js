import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { ADMIN_HARDCODED_CREDS } from "@/lib/adminCredentials";

export async function POST(request) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const trimmedPassword = String(password).trim();

    // 1. Check Admin Passwords (env-var-first, see lib/adminCredentials.js)
    const hardcodedAdmins = Object.values(ADMIN_HARDCODED_CREDS);
    if (hardcodedAdmins.includes(trimmedPassword)) {
      return NextResponse.json({ valid: true });
    }

    const db = getAdminDb();
    
    // Collections to check for the password
    const collectionsToCheck = ["students", "teachers", "users", "madarsas", "managers", "pariksha_board_convener"];

    for (const collectionName of collectionsToCheck) {
      try {
        const snap = await db
          .collection(collectionName)
          .where("password", "==", trimmedPassword)
          .limit(1)
          .get();
        
        if (!snap.empty) {
          return NextResponse.json({ valid: true });
        }
      } catch (error) {
        console.warn(`Error checking collection ${collectionName}:`, error);
      }
    }

    return NextResponse.json({ valid: false });
  } catch (error) {
    console.error("Error in validate-brand-password:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
