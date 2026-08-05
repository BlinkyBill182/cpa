import "server-only";

const FOLDER_MIME = "application/vnd.google-apps.folder";

// supportsAllDrives=true + includeItemsFromAllDrives=true are required for Shared Drives
const DRIVE_PARAMS = "supportsAllDrives=true&includeItemsFromAllDrives=true";

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * Exchange a stored OAuth2 refresh token for a short-lived access token.
 * Reads GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET from env.
 */
export async function getAccessTokenFromRefreshToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`OAuth token refresh failed: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// ─── Folder helpers ───────────────────────────────────────────────────────────

async function findFolder(token: string, name: string, parentId: string): Promise<string | null> {
  const q = `name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and '${parentId}' in parents and trashed = false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1&${DRIVE_PARAMS}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Drive folder search failed: ${await res.text()}`);
  const data = (await res.json()) as { files: { id: string }[] };
  return data.files[0]?.id ?? null;
}

async function createFolder(token: string, name: string, parentId: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${DRIVE_PARAMS}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  if (!res.ok) throw new Error(`Drive folder creation failed: ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Finds a folder by name under parentId, creating it if absent. */
async function ensureFolder(token: string, name: string, parentId: string): Promise<string> {
  const existing = await findFolder(token, name, parentId);
  return existing ?? (await createFolder(token, name, parentId));
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export type DriveUploadResult = {
  fileId: string;
  webViewLink: string;
};

/**
 * Uploads a file to Google Drive under:
 *   {rootFolderId} / {clientName} / {year} / {documentName} /
 *
 * Authenticates via an OAuth2 refresh token stored in tenant_secrets.
 */
export async function uploadToDrive(params: {
  refreshToken: string;
  rootFolderId: string;
  clientName: string;
  year: number;
  documentName: string;
  fileName: string;
  fileBuffer: ArrayBuffer;
  mimeType: string;
}): Promise<DriveUploadResult> {
  const { refreshToken, rootFolderId, clientName, year, documentName, fileName, fileBuffer, mimeType } = params;

  const token = await getAccessTokenFromRefreshToken(refreshToken);

  // Build the folder path: root / clientName / year / documentName
  const clientFolder = await ensureFolder(token, clientName, rootFolderId);
  const yearFolder = await ensureFolder(token, String(year), clientFolder);
  const docFolder = await ensureFolder(token, documentName, yearFolder);

  // Multipart upload: metadata + file body
  const metadata = JSON.stringify({ name: fileName, parents: [docFolder] });
  const boundary = `boundary_${Date.now()}`;
  const metaPart = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
  );
  const filePart = new TextEncoder().encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`);
  const closePart = new TextEncoder().encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(
    metaPart.byteLength + filePart.byteLength + fileBuffer.byteLength + closePart.byteLength,
  );
  let offset = 0;
  body.set(metaPart, offset); offset += metaPart.byteLength;
  body.set(filePart, offset); offset += filePart.byteLength;
  body.set(new Uint8Array(fileBuffer), offset); offset += fileBuffer.byteLength;
  body.set(closePart, offset);

  const uploadRes = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&${DRIVE_PARAMS}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!uploadRes.ok) {
    throw new Error(`Drive file upload failed: ${await uploadRes.text()}`);
  }

  const result = (await uploadRes.json()) as { id: string; webViewLink: string };
  return { fileId: result.id, webViewLink: result.webViewLink };
}

// ─── Download ─────────────────────────────────────────────────────────────────

/**
 * Extracts the Google Drive fileId from a webViewLink URL.
 * Supports: https://drive.google.com/file/d/{fileId}/view
 */
export function extractDriveFileId(webViewLink: string): string | null {
  const match = webViewLink.match(/\/file\/d\/([^/?#]+)/);
  return match?.[1] ?? null;
}

/**
 * Downloads a file from Google Drive by fileId.
 * Authenticates via an OAuth2 refresh token.
 */
export async function downloadFromDrive(params: {
  refreshToken: string;
  fileId: string;
}): Promise<ArrayBuffer> {
  const { refreshToken, fileId } = params;
  const token = await getAccessTokenFromRefreshToken(refreshToken);

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&${DRIVE_PARAMS}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    throw new Error(`Drive file download failed (${res.status}): ${await res.text()}`);
  }

  return res.arrayBuffer();
}
