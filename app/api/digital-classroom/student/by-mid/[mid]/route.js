export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET(request, { params }) {
  try {
    const { mid } = await params;

    if (!mid?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "MID number is required",
        },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    const rawMid = mid.trim();

    const cleanMid = rawMid
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    let normalizedMid = rawMid.toUpperCase();

    if (
      cleanMid.startsWith("MID") &&
      /\d+/.test(cleanMid)
    ) {
      normalizedMid =
        `MID-${cleanMid.replace("MID", "")}`;
    }

    const searchValues = [
      ...new Set([
        rawMid,
        rawMid.toUpperCase(),
        rawMid.toLowerCase(),
        normalizedMid,
        normalizedMid.toLowerCase(),
      ]),
    ];

    // Existing normal students collection
    const snapshot = await db
      .collection("students")
      .where(
        "admissionNumber",
        "in",
        searchValues
      )
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        {
          success: false,
          found: false,
          message:
            "No student found with this MID number",
        },
        { status: 404 }
      );
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return NextResponse.json({
      success: true,
      found: true,

      student: {
        studentId: doc.id,

        uid:
          data.uid || null,

        oldRegistrationNumber:
          data.admissionNumber ||
          normalizedMid,

        fullName:
          data.fullName ||
          data.studentName ||
          data.name ||
          "",

        dateOfBirth:
          data.dateOfBirth ||
          data.dob ||
          "",

        gender:
          data.gender || "",

        email:
          data.email || "",

        phone:
          data.phone ||
          data.mobileNumber ||
          "",

        guardianName:
          data.guardianName ||
          data.parentName ||
          "",

        guardianPhone:
          data.guardianPhone ||
          data.parentDetails?.phone ||
          "",

        address:
          data.address || "",

        profilePicture:
          data.profilePicture ||
          data.profilePictureUrl ||
          "",

        previousmadarsa:
          data.madarsaId ||
          data.madrasaId ||
          "",
      },
    });
  } catch (error) {
    console.error(
      "MID STUDENT SEARCH ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Failed to search student",
      },
      { status: 500 }
    );
  }
}