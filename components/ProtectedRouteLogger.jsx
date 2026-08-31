"use client";
import { useEffect } from "react";
export default function ProtectedRouteLogger({ state }) {
  useEffect(() => {
    console.log("PROTECTED ROUTE STATE:", state);
  }, Object.values(state));
  return null;
}
