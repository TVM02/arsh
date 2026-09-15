import { NextResponse } from "next/server";

import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import { getAdminDb } from "@/lib/firebase-admin";

const COLLECTION_NAME =
  "digitalClassStudentRegistrations";


// ============================================
// GET - View one registration
// ============================================

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Registration ID is required",
        },
        { status: 400 }
      );
    }

    const registrationRef = doc(
      db,
      COLLECTION_NAME,
      id
    );

    const registrationSnap =
      await getDoc(registrationRef);

    if (!registrationSnap.exists()) {
      return NextResponse.json(
        {
          success: false,
          message: "Registration not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,

        data: {
          id: registrationSnap.id,
          ...registrationSnap.data(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "View student registration error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch registration",
        error: error.message,
      },
      { status: 500 }
    );
  }
}


// ============================================
// PATCH - Edit registration
// ============================================

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Student ID is required",
        },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    const ref = db
      .collection("digitalClassStudentRegistrations")
      .doc(id);

    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Student registration not found",
        },
        { status: 404 }
      );
    }

    const protectedFields = [
      "id",
      "uid",
      "digitalAdmissionNumber",    
      "approval",      
      "passwordCreated",
    ];

    const updateData = { ...body };

    for (const field of protectedFields) {
      delete updateData[field];
    }

    updateData.updatedAt = new Date();

    await ref.update(updateData);

    const updatedSnap = await ref.get();

    return NextResponse.json({
      success: true,
      message: "Registration updated successfully",
      student: {
        id: updatedSnap.id,
        ...updatedSnap.data(),
      },
    });
  } catch (error) {
    console.error("DIGITAL STUDENT UPDATE ERROR:", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Failed to update registration",
        code: error?.code || null,
      },
      { status: 500 }
    );
  }
}


// ============================================
// DELETE - Delete registration
// ============================================

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Student registration ID is required",
        },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    const registrationRef = db
      .collection("digitalClassStudentRegistrations")
      .doc(id);

    const registrationSnap = await registrationRef.get();

    if (!registrationSnap.exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Digital student registration not found",
        },
        { status: 404 }
      );
    }

    await registrationRef.delete();

    return NextResponse.json(
      {
        success: true,
        message: "Digital student registration deleted successfully",
        id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE DIGITAL STUDENT ERROR:", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Failed to delete Digital Classroom student",
        code: error?.code || null,
      },
      { status: 500 }
    );
  }
}