export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  authorizeModelExam, failModelExam, validateTicket,
  ModelExamError,
} from "@/lib/modelExamServer";

const COLLECTION = "modelExamHallTickets";

export async function GET(request) {
  try {
    const { db } = await authorizeModelExam(request);
    const snapshot = await db.collection(COLLECTION).get();
    const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return NextResponse.json({ success: true, tickets });
  } catch (error) { return failModelExam(error); }
}

export async function POST(request) {
  try {
    const { db, uid } = await authorizeModelExam(request);
    const data = validateTicket(await request.json());
    const now = new Date().toISOString();
    // Document ID = hall ticket number; Firestore create() prevents duplicate numbers atomically.
    const ticketRef = db.collection(COLLECTION).doc(data.hallTicketNumber);
    const ticket = { ...data, createdAt: now, updatedAt: now, createdBy: uid, updatedBy: uid };
    try { await ticketRef.create(ticket); }
    catch (error) {
      if (error.code === 6 || error.code === "already-exists") {
        throw new ModelExamError("This Hall Ticket Number is already in use.", 409);
      }
      throw error;
    }
    return NextResponse.json({ success: true, ticket: { id: ticketRef.id, ...ticket } }, { status: 201 });
  } catch (error) { return failModelExam(error); }
}
