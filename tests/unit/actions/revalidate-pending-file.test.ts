import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireTenantAccessBySlug,
  createSupabaseAdminClient,
  validateUploadedDocument,
  downloadFromDrive,
  extractDriveFileId,
  revalidatePath,
} = vi.hoisted(() => ({
  requireTenantAccessBySlug: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  validateUploadedDocument: vi.fn(),
  downloadFromDrive: vi.fn(),
  extractDriveFileId: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireTenantAccessBySlug }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient }));
vi.mock("@/lib/ai-validation", () => ({ validateUploadedDocument }));
vi.mock("@/lib/google-drive", () => ({ downloadFromDrive, extractDriveFileId }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { revalidatePendingFileAction } from "@/app/[lang]/[slug]/clients/[clientId]/actions/annual-income-summary/actions";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT_FILE_ID = "22222222-2222-4222-8222-222222222222";
const CLIENT_YEAR_ID = "33333333-3333-4333-8333-333333333333";
const CLIENT_ID = "44444444-4444-4444-8444-444444444444";
const DOC_ID = "55555555-5555-4555-8555-555555555555";
const OWN_FILE_ID = "66666666-6666-4666-8666-666666666666";

type TableResult = { data: unknown; error?: null };

function createAdminMock(handlers: {
  uploaded_files?: {
    select?: TableResult;
    update?: TableResult & { eqIds?: string[] };
  };
  client_year_documents?: { select?: TableResult };
  client_years?: { select?: TableResult };
  document_types?: { select?: TableResult };
  tenant_secrets?: { select?: TableResult };
}) {
  const updateCalls: { table: string; payload: unknown; id?: string }[] = [];

  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;

    chain.select = vi.fn(self);
    chain.insert = vi.fn(self);
    chain.update = vi.fn((payload: unknown) => {
      updateCalls.push({ table, payload });
      return chain;
    });
    chain.eq = vi.fn((col: string, val: unknown) => {
      if (col === "id" && typeof val === "string") {
        const last = updateCalls[updateCalls.length - 1];
        if (last && last.id === undefined) last.id = val;
      }
      return chain;
    });
    chain.single = vi.fn(async () => {
      const result = handlers[table as keyof typeof handlers];
      if (result && "select" in result && result.select) return result.select;
      return { data: null, error: null };
    });

    return chain;
  });

  return { from, updateCalls };
}

function formData(overrides?: Partial<Record<string, string>>) {
  const fd = new FormData();
  fd.set("file_id", overrides?.file_id ?? OTHER_TENANT_FILE_ID);
  fd.set("client_year_id", overrides?.client_year_id ?? CLIENT_YEAR_ID);
  fd.set("client_id", overrides?.client_id ?? CLIENT_ID);
  fd.set("year", overrides?.year ?? "2025");
  return fd;
}

describe("revalidatePendingFileAction ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireTenantAccessBySlug.mockResolvedValue({
      tenant: { id: TENANT_ID, slug: "acme" },
      user: { id: "user-1" },
      role: "staff",
    });
  });

  it("rejects a file_id that is not linked to the submitted client_year (no status mutation)", async () => {
    const admin = createAdminMock({
      uploaded_files: {
        select: {
          data: {
            id: OTHER_TENANT_FILE_ID,
            drive_url: "https://drive.google.com/file/d/abc/view",
            original_filename: "form106.pdf",
            client_year_document_id: DOC_ID,
          },
        },
      },
      // Document belongs to a different client_year than the one in the form
      client_year_documents: { select: { data: null } },
    });
    createSupabaseAdminClient.mockReturnValue(admin);

    const result = await revalidatePendingFileAction("he", "acme", null, formData());

    expect(result).toEqual({ status: "error", message: "הקובץ לא נמצא" });
    expect(admin.updateCalls).toHaveLength(0);
    expect(downloadFromDrive).not.toHaveBeenCalled();
    expect(validateUploadedDocument).not.toHaveBeenCalled();
  });

  it("rejects when client_year does not belong to the caller's tenant", async () => {
    const admin = createAdminMock({
      uploaded_files: {
        select: {
          data: {
            id: OTHER_TENANT_FILE_ID,
            drive_url: "https://drive.google.com/file/d/abc/view",
            original_filename: "form106.pdf",
            client_year_document_id: DOC_ID,
          },
        },
      },
      client_year_documents: {
        select: {
          data: {
            id: DOC_ID,
            custom_name: null,
            document_type_id: null,
            client_year_id: CLIENT_YEAR_ID,
          },
        },
      },
      client_years: { select: { data: null } },
    });
    createSupabaseAdminClient.mockReturnValue(admin);

    const result = await revalidatePendingFileAction("he", "acme", null, formData());

    expect(result).toEqual({ status: "error", message: "שנת הלקוח לא נמצאה" });
    expect(admin.updateCalls).toHaveLength(0);
  });

  it("does not mark ai_status invalid when Drive download fails", async () => {
    const admin = createAdminMock({
      uploaded_files: {
        select: {
          data: {
            id: OWN_FILE_ID,
            drive_url: "https://drive.google.com/file/d/abc/view",
            original_filename: "form106.pdf",
            client_year_document_id: DOC_ID,
          },
        },
      },
      client_year_documents: {
        select: {
          data: {
            id: DOC_ID,
            custom_name: "טופס 106",
            document_type_id: null,
            client_year_id: CLIENT_YEAR_ID,
          },
        },
      },
      client_years: {
        select: {
          data: { year: 2025, tenant_id: TENANT_ID, client_id: CLIENT_ID },
        },
      },
      tenant_secrets: {
        select: { data: { encrypted_key: "refresh-token" } },
      },
    });
    createSupabaseAdminClient.mockReturnValue(admin);
    extractDriveFileId.mockReturnValue("abc");
    downloadFromDrive.mockRejectedValue(new Error("Drive 503"));

    const result = await revalidatePendingFileAction(
      "he",
      "acme",
      null,
      formData({ file_id: OWN_FILE_ID }),
    );

    expect(result?.status).toBe("error");
    expect(admin.updateCalls).toHaveLength(0);
  });
});
