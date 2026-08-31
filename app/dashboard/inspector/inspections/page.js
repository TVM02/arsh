import { redirect } from "next/navigation";

// This page is no longer needed — "New Report" on the reports page
// goes directly to the create form. Redirect any direct visits.
export default function InspectionsPage() {
  redirect("/dashboard/inspector/inspections/create");
}
