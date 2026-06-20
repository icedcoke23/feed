import { Suspense } from "react";
import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth/server-auth";
import HomeClient from "./home-client";
import { HomePageSkeleton } from "@/components/business/page-skeleton";

export default async function HomePage() {
  const user = await verifyAuth();
  if (!user) redirect("/login");

  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <HomeClient />
    </Suspense>
  );
}
