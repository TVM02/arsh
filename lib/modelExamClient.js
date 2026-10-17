"use client";

import { getAuth } from "firebase/auth";

async function requestModelExam(path, method = "GET", data) {
  const user = getAuth().currentUser;
  if (!user) throw new Error("Please sign in again.");
  const token = await user.getIdToken();
  const response = await fetch(path, {
    method,
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success !== true) {
    throw new Error(result.message || `Request failed (HTTP ${response.status}).`);
  }
  return result;
}

export const listModelExamHallTickets = () => requestModelExam("/api/model-exam/hall-tickets");
export const createModelExamHallTicket = (data) => requestModelExam("/api/model-exam/hall-tickets", "POST", data);
export const editModelExamHallTicket = (id, data) => requestModelExam(`/api/model-exam/hall-tickets/${encodeURIComponent(id)}`, "PATCH", data);
export const deleteModelExamHallTicket = (id) => requestModelExam(`/api/model-exam/hall-tickets/${encodeURIComponent(id)}`, "DELETE");
export const getModelExamTimetables = () => requestModelExam("/api/model-exam/timetables");
export const saveModelExamTimetables = (data) => requestModelExam("/api/model-exam/timetables", "PUT", data);
