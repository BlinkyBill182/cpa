import { redirect } from "next/navigation";

export default async function BackofficePage() {
  redirect("/backoffice/tenants");
}
