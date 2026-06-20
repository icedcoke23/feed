import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth/server-auth";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const user = await verifyAuth();
  if (!user) redirect("/login");

  return <SettingsClient />;
}
