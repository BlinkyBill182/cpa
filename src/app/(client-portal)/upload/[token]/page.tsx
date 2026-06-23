import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyUploadToken } from "@/lib/upload-token";

import UploadButton from "./UploadButton";

type UploadPortalPageProps = {
  params: Promise<{ token: string }>;
};

function TokenInvalid() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center" dir="rtl" lang="he">
      <span className="text-5xl leading-none">🔒</span>
      <h1 className="text-xl font-bold text-gray-900">הקישור אינו תקף</h1>
      <p className="max-w-xs text-sm text-gray-500">
        הקישור שהשתמשתם בו פג תוקף או אינו חוקי. אנא פנו למשרד רואי החשבון לקבלת קישור חדש.
      </p>
    </div>
  );
}

export default async function UploadPortalPage({ params }: UploadPortalPageProps) {
  const { token } = await params;

  const payload = await verifyUploadToken(token);
  if (!payload) return <TokenInvalid />;

  const supabase = createSupabaseAdminClient();

  const { data: clientYear } = await supabase
    .from("client_years")
    .select("id, year, client_id")
    .eq("id", payload.clientYearId)
    .single();

  if (!clientYear) return <TokenInvalid />;

  // Fetch docs with allowed_formats
  const { data: rawDocs } = await supabase
    .from("client_year_documents")
    .select("id, custom_name, free_text, is_required, sort_order, document_type_id, allowed_formats")
    .eq("client_year_id", clientYear.id)
    .order("sort_order");

  const docIds = (rawDocs ?? []).map((d) => d.id);

  // Fetch client, doc types, and existing uploads in parallel
  const [{ data: client }, { data: docTypes }, { data: existingUploads }] = await Promise.all([
    supabase
      .from("office_clients")
      .select("name, phone, email")
      .eq("id", clientYear.client_id)
      .single(),
    (async () => {
      const typeIds = (rawDocs ?? [])
        .map((d) => d.document_type_id)
        .filter((id): id is string => id !== null);
      if (typeIds.length === 0) return { data: [] };
      return supabase.from("document_types").select("id, name, allowed_formats").in("id", typeIds);
    })(),
    docIds.length > 0
      ? supabase
          .from("uploaded_files")
          .select("id, original_filename, file_size_kb, uploaded_at, upload_status, client_year_document_id")
          .in("client_year_document_id", docIds)
          .order("uploaded_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const docTypeMap = new Map((docTypes ?? []).map((dt) => [dt.id, dt]));

  // Group existing uploads by document id
  const uploadsByDoc = new Map<string, typeof existingUploads>() ;
  for (const u of existingUploads ?? []) {
    const list = uploadsByDoc.get(u.client_year_document_id) ?? [];
    list.push(u);
    uploadsByDoc.set(u.client_year_document_id, list);
  }

  const allDocs = (rawDocs ?? []).map((doc) => {
    const dt = doc.document_type_id ? docTypeMap.get(doc.document_type_id) : null;
    const effectiveFormats: string[] =
      (doc.allowed_formats ?? []).length > 0
        ? (doc.allowed_formats ?? [])
        : (dt?.allowed_formats ?? []);
    return {
      ...doc,
      displayName: dt?.name ?? doc.custom_name ?? "—",
      effectiveFormats,
      uploads: uploadsByDoc.get(doc.id) ?? [],
    };
  });

  const required = allDocs.filter((d) => d.is_required);
  const optional = allDocs.filter((d) => !d.is_required);
  const totalCount = allDocs.length;

  return (
    <div className="flex flex-col gap-6" dir="rtl" lang="he">
      {/* Client greeting */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-gray-900">
          שלום, {client?.name ?? "לקוח יקר"}
        </h1>
        <p className="text-sm text-gray-500">
          שנת מס {clientYear.year} · {totalCount} מסמכים
        </p>
      </div>

      {/* Required documents */}
      {required.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-gray-800">מסמכים חובה</span>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {required.length}
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {required.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                    <span className="text-base leading-none">📄</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 text-right">
                    <p className="text-sm font-semibold text-gray-800">{doc.displayName}</p>
                    {doc.free_text && (
                      <p className="text-xs text-gray-500">{doc.free_text}</p>
                    )}
                    <span className="w-fit self-end rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                      חובה
                    </span>
                  </div>
                </div>
                <UploadButton
                  clientYearDocumentId={doc.id}
                  token={token}
                  allowedFormats={doc.effectiveFormats}
                  initialUploads={doc.uploads as Parameters<typeof UploadButton>[0]["initialUploads"]}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Optional documents */}
      {optional.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-gray-800">מסמכים אופציונליים</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {optional.length}
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {optional.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <span className="text-base leading-none">📎</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 text-right">
                    <p className="text-sm font-semibold text-gray-800">{doc.displayName}</p>
                    {doc.free_text && (
                      <p className="text-xs text-gray-500">{doc.free_text}</p>
                    )}
                    <span className="w-fit self-end rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500">
                      אופציונלי
                    </span>
                  </div>
                </div>
                <UploadButton
                  clientYearDocumentId={doc.id}
                  token={token}
                  allowedFormats={doc.effectiveFormats}
                  initialUploads={doc.uploads as Parameters<typeof UploadButton>[0]["initialUploads"]}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {totalCount === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 py-12 text-center">
          <span className="text-4xl leading-none">✅</span>
          <p className="text-sm font-medium text-gray-600">לא הוגדרו דרישות מסמכים לשנה זו</p>
        </div>
      )}

      {/* Contact block */}
      {(client?.phone || client?.email) && (
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 text-right">צרו קשר</p>
          <div className="flex flex-col gap-2">
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                className="flex items-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm active:bg-green-600"
              >
                <span className="text-base leading-none">📞</span>
                <span className="flex-1 text-center">{client.phone}</span>
              </a>
            )}
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 shadow-sm active:bg-gray-50"
              >
                <span className="text-base leading-none">✉️</span>
                <span className="flex-1 text-center">{client.email}</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
