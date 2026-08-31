export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { requireServerRole } from "@/lib/serverAuth";

export async function POST(req) {
  try {
    await requireServerRole(req, ["central_admin", "admin", "madarsa_admin"]);

    const {
      name,
      password,
      madarsaId,
      madarsaName,
      createdBy,
      phone,
      address,
      institutionName,
      status,
      position,
    } = await req.json();

    if (!name || !password || !madarsaId) {
      return NextResponse.json(
        { error: "name, password, madarsaId are required" },
        { status: 400 },
      );
    }

    const safePhone = (phone || "").trim();
    const email = safePhone ? `${safePhone}@dkju.in` : `${madarsaId.toLowerCase().replace(/[^a-z0-9]/g, "")}@dkju.in`;

    let auth;
    let db;
    try {
      auth = getAdminAuth();
      db = getAdminDb();
    } catch (initErr) {
      console.error("[create-manager] Admin SDK init failed:", initErr);
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    // 1. Try to find an existing manager for this madarsaId
    let existingSnap = await db
      .collection("managers")
      .where("madarsaId", "==", madarsaId)
      .get();

    // 2. If not found by madarsaId, try finding by phone (only if phone is provided)
    if (existingSnap.empty && safePhone) {
      existingSnap = await db
        .collection("managers")
        .where("phone", "==", safePhone)
        .get();
    }
      
    if (!existingSnap.empty) {
      // If manager exists, update their details
      const existingDoc = existingSnap.docs[0];
      const existingData = existingDoc.data();
      const existingEmail = existingData.email || `${existingData.phone}@dkju.in`;
      
      try {
        let user;
        try {
          user = await auth.getUserByEmail(existingEmail);
          // If phone changed, update email as well
          const updateParams = { password, displayName: name };
          if (existingEmail !== email) {
            updateParams.email = email;
          }
          await auth.updateUser(user.uid, updateParams);
        } catch (e) {
          if (e.code === "auth/user-not-found" || e.code === "auth/email-already-exists") {
             try {
               user = await auth.getUserByEmail(email);
               await auth.updateUser(user.uid, { password, displayName: name });
             } catch (recoveryErr) {
               user = await auth.createUser({
                 email,
                 password,
                 displayName: name,
               });
             }
          } else {
             throw e;
          }
        }
        
        // Update the firestore document with the new details
        const updateData = {
          phone: safePhone,
          password,
          email,
          name,
          madarsaName,
          madarsaId, // Ensure madarsaId is updated to the latest one if they re-used phone
          updatedAt: new Date().toISOString(),
        };
        if (address !== undefined) updateData.address = address;
        if (status !== undefined) updateData.status = status;
        if (position !== undefined) updateData.position = position;
        
        await existingDoc.ref.update(updateData);

        return NextResponse.json({
          success: true,
          managerId: existingDoc.id,
          uid: user.uid,
          message: "Existing manager updated successfully",
        });
      } catch (err) {
        console.error("[create-manager] Error updating existing manager:", err);
        return NextResponse.json(
          { error: "Failed to update existing manager." },
          { status: 500 },
        );
      }
    }

    // Create Firebase Auth user
    let authUser;
    try {
      authUser = await auth.createUser({
        email,
        password,
        displayName: name,
      });
    } catch (authErr) {
      if (authErr.code === "auth/email-already-exists") {
        // The user exists in Auth but not in Firestore. Recover by updating password.
        try {
          authUser = await auth.getUserByEmail(email);
          await auth.updateUser(authUser.uid, { password, displayName: name });
        } catch (recoveryErr) {
          console.error("[create-manager] Recovery failed:", recoveryErr);
          return NextResponse.json({ error: "Failed to recover existing auth profile." }, { status: 500 });
        }
      } else {
        const authErrorMessages = {
          "auth/invalid-email":
            "The phone/email combination is invalid.",
          "auth/weak-password":
            "Password is too weak. Use at least 6 characters.",
          "auth/invalid-password": "Invalid password provided.",
          "auth/operation-not-allowed":
            "Email/password sign-in is not enabled in Firebase.",
        };
        const friendlyMsg = authErrorMessages[authErr.code];
        if (friendlyMsg) {
          return NextResponse.json({ error: friendlyMsg }, { status: 400 });
        }
        console.error(
          "[create-manager] auth.createUser failed:",
          authErr.code,
        );
        return NextResponse.json(
          { error: "Failed to create account" },
          { status: 500 },
        );
      }
    }

    const now = new Date().toISOString();

    // Save to managers Firestore collection
    const docRef = await db.collection("managers").add({
      name,
      email,
      password, // Save password so legacy login works if Firebase auth fails
      phone: safePhone,
      address: address || "",
      institutionName: institutionName || "",
      firebaseAuthUid: authUser.uid,
      madarsaId,
      madarsaName: madarsaName || "",
      position: position || "Others",
      status: "active",
      createdBy: createdBy || "",
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      managerId: docRef.id,
      uid: authUser.uid,
    });
  } catch (err) {
    console.error("[create-manager] error:", err);
    if (err.status) {
      return NextResponse.json({ error: "Not authorized" }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Failed to create manager" },
      { status: 500 },
    );
  }
}
