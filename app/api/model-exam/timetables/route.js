export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  authorizeModelExam, failModelExam,
  DEFAULT_MODEL_EXAM_SETTINGS, normalizeSettings,
} from "@/lib/modelExamServer";

const REF = "modelExamHallTicketSettings";

export async function GET(request) {
  try {
    const { db } = await authorizeModelExam(request);
    const snap = await db.collection(REF).doc("global").get();
    const settings = {
      ...DEFAULT_MODEL_EXAM_SETTINGS,
      ...(snap.data() || {}),
      timetables: {
        ...DEFAULT_MODEL_EXAM_SETTINGS.timetables,
        ...(snap.data()?.timetables || {}),
      },
    };
    return NextResponse.json({ success: true, settings });
  } catch (error) { return failModelExam(error); }
}

export async function PUT(request) {
  try {
    const { db, uid } = await authorizeModelExam(request);
    const settings = normalizeSettings(await request.json());
    const updated = { ...settings, updatedBy: uid, updatedAt: new Date().toISOString() };
    await db.collection(REF).doc("global").set(updated, { merge: true });
    return NextResponse.json({ success: true, settings: updated });
  } catch (error) { return failModelExam(error); }
}
