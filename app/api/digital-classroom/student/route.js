export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
   

    const db = getAdminDb();


    const snapshot = await db
      .collection("digitalClassStudentRegistrations")
      .get();

    

    const students = snapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        ...data,

        // convert Firestore timestamps safely
        createdAt:
          data.createdAt?.toDate?.()?.toISOString?.() ||
          data.createdAt ||
          null,

        updatedAt:
          data.updatedAt?.toDate?.()?.toISOString?.() ||
          data.updatedAt ||
          null,
      };
    });

    // latest first
    students.sort((a, b) => {
      const dateA = a.createdAt
        ? new Date(a.createdAt).getTime()
        : 0;

      const dateB = b.createdAt
        ? new Date(b.createdAt).getTime()
        : 0;

      return dateB - dateA;
    });

    return NextResponse.json(
      {
        success: true,
        students,
        total: students.length,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "DIGITAL STUDENT GET ERROR:",
      {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
      }
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Failed to fetch registrations",

        code:
          error?.code || null,
      },
      {
        status: 500,
      }
    );
  }
}