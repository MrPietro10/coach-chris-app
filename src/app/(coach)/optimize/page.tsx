import { redirect } from "next/navigation";
import OptimizePageClient from "./optimize-page-client";
import { isAuthenticatedUserAdmin } from "@/lib/session-user";

export default async function OptimizePage() {
  const isAdmin = await isAuthenticatedUserAdmin();
  if (!isAdmin) {
    redirect("/results");
  }

  return <OptimizePageClient />;
}
