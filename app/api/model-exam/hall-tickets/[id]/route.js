export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  authorizeModelExam, failModelExam, validateTicket, ModelExamError,
} from "@/lib/modelExamServer";

const COLLECTION = "modelExamHallTickets";

export async function PATCH(request, context) {
  try {
    const { db, uid } = await authorizeModelExam(request);
    const { id } = await context.params;
    if (!/^\d{1,16}$/.test(id || "")) throw new ModelExamError("Invalid Hall Ticket ID.");
    const data = validateTicket(await request.json());
    const oldRef = db.collection(COLLECTION).doc(id);
    const nextRef = db.collection(COLLECTION).doc(data.hallTicketNumber);
    const now = new Date().toISOString();
    let updated;

    // Handles editing the hall-ticket number too, without losing the original record.
    await db.runTransaction(async transaction => {
      const current = await transaction.get(oldRef);
      if (!current.exists) throw new ModelExamError("Hall ticket not found.", 404);
      if (data.hallTicketNumber !== id) {
        const duplicate = await transaction.get(nextRef);
        if (duplicate.exists) throw new ModelExamError("New Hall Ticket Number already exists.", 409);
      }
      updated = { ...current.data(), ...data, updatedAt: now, updatedBy: uid };
      if (data.hallTicketNumber === id) transaction.set(oldRef, updated);
      else { transaction.create(nextRef, updated); transaction.delete(oldRef); }
    });
    return NextResponse.json({ success: true, ticket: { id: data.hallTicketNumber, ...updated } });
  } catch (error) { return failModelExam(error); }
}

export async function DELETE(request, context) {
  try {
    const { db } = await authorizeModelExam(request);
    const { id } = await context.params;
    if (!/^\d{1,16}$/.test(id || "")) throw new ModelExamError("Invalid Hall Ticket ID.");
    const ref = db.collection(COLLECTION).doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new ModelExamError("Hall ticket not found.", 404);
    await ref.delete();
    return NextResponse.json({ success: true, message: "Hall ticket deleted." });
  } catch (error) { return failModelExam(error); }
}
