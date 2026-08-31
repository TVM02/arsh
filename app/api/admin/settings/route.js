export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireCentralAdmin } from "@/lib/serverAuth";

const ALLOWED_SETTING_KEYS = new Set([
  "studentEdit",
  "studentSelfEdit",
  "showResults",
  "showAdmissions",
  "revaluationEnabled",
  "resultWindow",
  "admissionFees",
  "totalWorkingDays",
  "requiredPresentDays",
  "totalHolidays",
]);

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const sanitizeSettingsPatch = (body) => {
  if (!isPlainObject(body)) {
    throw new Error("Invalid settings payload.");
  }

  const patch = {};

  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_SETTING_KEYS.has(key)) continue;

    if (
      [
        "studentEdit",
        "studentSelfEdit",
        "showResults",
        "showAdmissions",
        "revaluationEnabled",
      ].includes(key)
    ) {
      if (typeof value !== "boolean") {
        throw new Error(`${key} must be true or false.`);
      }
      patch[key] = value;
      continue;
    }

    if (key === "resultWindow") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
        throw new Error("Result window must be between 1 and 365 days.");
      }
      patch.resultWindow = parsed;
      continue;
    }

    if (key === "totalWorkingDays" || key === "requiredPresentDays" || key === "totalHolidays") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 365) {
        throw new Error(`${key} must be between 0 and 365 days.`);
      }
      patch[key] = parsed;
      continue;
    }

    if (key === "admissionFees") {
      if (!isPlainObject(value)) {
        throw new Error("Admission fees must be an object.");
      }

      patch.admissionFees = Object.fromEntries(
        Object.entries(value).map(([className, amount]) => {
          const parsed = Number(amount);
          if (!Number.isFinite(parsed) || parsed < 0) {
            throw new Error(`Invalid admission fee for ${className}.`);
          }
          return [String(className).toLowerCase(), parsed];
        }),
      );
    }
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("No supported settings were provided.");
  }

  return patch;
};

export async function PATCH(request) {
  try {
    const { decoded, db } = await requireCentralAdmin(request);
    const body = await request.json().catch(() => null);
    const patch = sanitizeSettingsPatch(body);

    await db
      .collection("settings")
      .doc("general")
      .set(
        {
          ...patch,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: decoded.uid,
        },
        { merge: true },
      );

    return NextResponse.json({ ok: true, settings: patch });
  } catch (error) {
    const status = error.status || (error.message?.includes("Invalid") ? 400 : 500);
    console.error("[admin/settings] PATCH error:", error);
    return NextResponse.json(
      {
        error:
          status === 400
            ? error.message || "Invalid settings payload."
            : "Failed to update settings.",
      },
      { status },
    );
  }
}
