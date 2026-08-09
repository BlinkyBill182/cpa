import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyUploadToken } from "@/lib/upload-token";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

/**
 * GET /api/upload/[fileId]/status?token=...
 *
 * Poll AI validation status for a file uploaded via the client portal JWT.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { fileId } = await context.params;
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const payload = await verifyUploadToken(token);
  if (!payload) {
    return NextResponse.json({ error: "הקישור אינו תקף או פג תוקפו" }, { status: 401 });
  }

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(fileId)) {
    return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: file, error } = await supabase
    .from("uploaded_files")
    .select(
      `id, ai_status, ai_notes, ai_result, client_year_document_id,
       client_year_documents!inner ( client_year_id )`,
    )
    .eq("id", fileId)
    .single();

  if (error || !file) {
    return NextResponse.json({ error: "הקובץ לא נמצא" }, { status: 404 });
  }

  const cyd = file.client_year_documents as { client_year_id: string } | null;
  if (!cyd || cyd.client_year_id !== payload.clientYearId) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  return NextResponse.json({
    id: file.id,
    ai_status: file.ai_status,
    ai_notes: file.ai_notes,
    ai_result: file.ai_result,
  });
}
