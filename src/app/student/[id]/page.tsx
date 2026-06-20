import { notFound, redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth/server-auth";
import { fetchStudentById } from "@/lib/services/server-student-detail-service";
import StudentDetailClient from "./student-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StudentDetailPage({ params }: Props) {
  const user = await verifyAuth();
  if (!user) redirect("/login");

  const { id } = await params;
  const student = await fetchStudentById(id);
  if (!student) notFound();

  return <StudentDetailClient student={student} />;
}
