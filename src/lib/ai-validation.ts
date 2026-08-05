/**
 * AI-powered document validation for Israeli CPA forms.
 *
 * Extraction path (in priority order):
 *   1. AWS Textract (AnalyzeDocument) — if AWS_ACCESS_KEY_ID is configured.
 *      Extracts structured key-value pairs from forms before sending to Claude.
 *   2. Claude native vision — PDFs and images sent directly; Claude reads the
 *      document visually without a pre-extraction step.
 *   3. Skipped — unsupported types (xlsx, docx, zip, csv) that cannot be read
 *      visually; these return a neutral result.
 *
 * Validation path:
 *   Claude Sonnet (claude-sonnet-4-5) acting as an Israeli CPA expert.
 *   Returns structured JSON: { formType, isValid, errors[], warnings[] }
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ValidationError = {
  field: string;
  message: string;
};

export type AIValidationResult = {
  /** true = passed all required checks */
  valid: boolean;
  /** 0.0 – 1.0  confidence in the result */
  confidence: number;
  /** Hebrew summary note — backward-compat for simple display */
  notes: string | null;
  // ── Structured output ──────────────────────────────────────────────────────
  /** Identified form type, e.g. "טופס 106", "טופס 101" */
  formType: string | null;
  /** Tax year found in the document */
  formYear: number | null;
  /** Hard errors — document is invalid */
  errors: ValidationError[];
  /** Soft warnings — document may be OK but needs attention */
  warnings: ValidationError[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SUPPORTED_VISUAL_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Graceful default — used when AI is unavailable or file type is unsupported */
function skip(reason: "no_api_key" | "unsupported_type"): AIValidationResult {
  return {
    valid: true,
    confidence: reason === "unsupported_type" ? 0.5 : 0,
    notes: null,
    formType: null,
    formYear: null,
    errors: [],
    warnings:
      reason === "unsupported_type"
        ? [{ field: "סוג קובץ", message: "סוג קובץ זה אינו נתמך לבדיקה אוטומטית" }]
        : [],
  };
}

// ─── Textract extraction (optional) ──────────────────────────────────────────

/**
 * Attempts to extract structured text and key-value pairs from the document
 * using AWS Textract.
 *
 * Required env vars:  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 *
 * Returns null when AWS credentials are absent or Textract fails, in which
 * case the caller falls back to Claude native vision.
 */
async function extractWithTextract(
  fileBuffer: ArrayBuffer,
  mimeType: string,
): Promise<string | null> {
  const keyId = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION ?? "us-east-1";

  if (!keyId || !secret) return null;

  try {
    // Dynamic import so the AWS SDK is only loaded when credentials are present
    const { TextractClient, AnalyzeDocumentCommand } = await import(
      "@aws-sdk/client-textract"
    );

    const client = new TextractClient({
      region,
      credentials: { accessKeyId: keyId, secretAccessKey: secret },
    });

    const bytes = new Uint8Array(fileBuffer);

    const response = await client.send(
      new AnalyzeDocumentCommand({
        Document: { Bytes: bytes },
        // FORMS extracts key-value pairs; TABLES extracts table grids
        FeatureTypes: ["FORMS", "TABLES"],
      }),
    );

    const blocks = response.Blocks ?? [];

    // ── Reconstruct key-value pairs from Textract FORM analysis ──────────────
    const keyMap = new Map<string, string>(); // blockId → text
    const lines: string[] = [];

    for (const block of blocks) {
      if (block.BlockType === "LINE" && block.Text) {
        lines.push(block.Text);
      }
      if (block.BlockType === "KEY_VALUE_SET" && block.EntityTypes?.includes("KEY")) {
        const keyText = block.Relationships?.find((r) => r.Type === "CHILD")
          ?.Ids?.map((id) => {
            const child = blocks.find((b) => b.Id === id);
            return child?.Text ?? "";
          })
          .join(" ") ?? "";

        const valueBlockId = block.Relationships?.find((r) => r.Type === "VALUE")?.Ids?.[0];
        const valueBlock = blocks.find((b) => b.Id === valueBlockId);
        const valueText =
          valueBlock?.Relationships?.find((r) => r.Type === "CHILD")
            ?.Ids?.map((id) => {
              const child = blocks.find((b) => b.Id === id);
              return child?.Text ?? "";
            })
            .join(" ") ?? "";

        if (keyText.trim()) keyMap.set(keyText.trim(), valueText.trim());
      }
    }

    const kvSection =
      keyMap.size > 0
        ? "\n--- שדות מזוהים ---\n" +
          [...keyMap.entries()].map(([k, v]) => `${k}: ${v}`).join("\n")
        : "";

    const lineSection = lines.length > 0 ? "\n--- טקסט מלא ---\n" + lines.join("\n") : "";

    const extracted = (kvSection + lineSection).trim();
    return extracted.length > 0 ? extracted : null;
  } catch (e) {
    console.warn("[ai-validation] Textract failed, falling back to Claude vision:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert Israeli CPA (רואה חשבון) specializing in validating Israeli tax and social-security documents.

## Your task
Validate the document the user provides.  Respond with ONLY a JSON object — no markdown, no prose.

## Output schema
{
  "formType": "string | null",   // e.g. "טופס 106", "טופס 101", "ביטוח לאומי 632", null if unrecognised
  "formYear": number | null,     // tax/calendar year found in the document, null if absent
  "isValid": boolean,
  "confidence": number,          // 0.0 – 1.0
  "errors": [                    // hard problems — document should be rejected
    { "field": "string", "message": "string (Hebrew)" }
  ],
  "warnings": [                  // soft issues — review recommended
    { "field": "string", "message": "string (Hebrew)" }
  ]
}

## Israeli forms you know

### טופס 106 — אישור שנתי מהמעסיק
- Issuer: employer; given to employee + tax authority
- Required fields: מספר מעסיק (9 digits), תעודת זהות עובד (9 digits), שנת מס, שם עובד,
  שכר ברוטו (code 158/172), מס הכנסה שנוכה (code 042), ביטוח לאומי חלק עובד (code 045),
  מס בריאות (code 047)
- Calculations to verify:
  - ניכוי מס should be consistent with gross income and the applicable tax bracket
  - BI employee share ≈ gross × applicable NI rate (varies by income band)
  - Health tax ≈ gross × 3.1% (5% above threshold)

### טופס 101 — הצהרת עובד
- Signed by employee at start of employment or when status changes
- Required: ID, name, address, marital status, other employers, pension fund
- Validate: ID format, date fields

### טופס 135 — דין וחשבון שנתי (שכיר / עצמאי)
- Annual self-assessment
- Required: ID, income from all sources, deductions, tax credit points

### ביטוח לאומי 632 — דו"ח רב-שנתי
- Required: employer number, periods, wage totals, BI contributions

### הסכם שכר / תלוש שכר (Payslip)
- Not an official tax form but validate employer number, gross/net, deductions

## Validation rules
1. **Israeli ID (ת.ז.)** — 9 digits; must pass the Luhn-style check:
   multiply digits at positions 1,3,5,7,9 by 1 and positions 2,4,6,8 by 2;
   if product > 9 subtract 9; sum all; valid iff sum % 10 == 0.
2. **Employer number (מספר מעסיק)** — 9 digits, starts with a valid issuing-authority prefix.
3. **Dates** — must be in Israeli format DD/MM/YYYY or YYYY; future dates are errors.
4. **Year match** — the document year must match the expected year supplied in the prompt.
5. **Amounts** — must be positive numbers; unrealistically large values (>10M ₪) are warnings.
6. **Blank required fields** — error if a required field is empty or "0" when it should not be.

## Tone
All error.message and warning.message values must be in Hebrew.
Be concise — max 15 words per message.
If the document is completely illegible or clearly not a tax/payroll document, set isValid=false and add an error: { "field": "מסמך", "message": "המסמך אינו טופס מס ישראלי מוכר" }.`;

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Validates an uploaded document.
 *
 * Steps:
 *  1. (optional) Textract text extraction
 *  2. Claude Sonnet validation with Israeli CPA system prompt
 *     + optional per-document-type validation_prompt
 *  3. Returns AIValidationResult
 *
 * Never throws — a failed validation returns valid=true with confidence=0.
 */
export async function validateUploadedDocument(params: {
  fileBuffer: ArrayBuffer;
  mimeType: string;
  documentName: string;
  year: number;
  /** Optional CPA-written prompt from document_types.validation_prompt */
  validationPrompt?: string | null;
}): Promise<AIValidationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[ai-validation] ANTHROPIC_API_KEY not configured — skipping validation");
    return skip("no_api_key");
  }

  const { fileBuffer, mimeType, documentName, year, validationPrompt } = params;

  if (!SUPPORTED_VISUAL_MIMES.has(mimeType)) {
    return skip("unsupported_type");
  }

  // Build the effective system prompt — inject the custom prompt if provided
  const effectiveSystemPrompt = validationPrompt?.trim()
    ? `${SYSTEM_PROMPT}

---
## הוראות ספציפיות לסוג מסמך זה (מוגדרות על ידי רואה החשבון):
${validationPrompt.trim()}
---`
    : SYSTEM_PROMPT;

  try {
    const anthropic = new Anthropic({ apiKey });

    // ── Step 1: Try Textract extraction ──────────────────────────────────────
    const extractedText = await extractWithTextract(fileBuffer, mimeType);

    let userContent: Anthropic.MessageParam["content"];

    if (extractedText) {
      // Textract succeeded — send extracted text to Claude as text-only
      userContent = [
        {
          type: "text",
          text: `המסמך שהלקוח אמור להגיש: "${documentName}"
שנת מס צפויה: ${year}

הטקסט שחולץ מהמסמך על ידי OCR:
${extractedText}

אנא בצע את הבדיקה המלאה וחזור עם JSON בלבד.`,
        },
      ];
    } else {
      // No Textract — send the raw document to Claude for native vision
      const base64 = Buffer.from(fileBuffer).toString("base64");

      const isPdf = mimeType === "application/pdf";
      const docSource = isPdf
        ? ({ type: "base64", media_type: "application/pdf", data: base64 } as const)
        : ({
            type: "base64",
            media_type: mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data: base64,
          } as const);

      const docBlock = isPdf
        ? ({ type: "document", source: docSource } as const)
        : ({ type: "image", source: docSource } as const);

      userContent = [
        docBlock,
        {
          type: "text",
          text: `המסמך שהלקוח אמור להגיש: "${documentName}"
שנת מס צפויה: ${year}

אנא בצע את הבדיקה המלאה וחזור עם JSON בלבד.`,
        },
      ];
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: effectiveSystemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";

    // Strip accidental markdown fences
    const json = rawText.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();

    type ClaudeOutput = {
      formType?: string | null;
      formYear?: number | null;
      isValid?: boolean;
      confidence?: number;
      errors?: ValidationError[];
      warnings?: ValidationError[];
    };

    const parsed: ClaudeOutput = JSON.parse(json);

    const errors: ValidationError[] = Array.isArray(parsed.errors) ? parsed.errors : [];
    const warnings: ValidationError[] = Array.isArray(parsed.warnings) ? parsed.warnings : [];
    const isValid = parsed.isValid ?? errors.length === 0;
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.8;

    // Backward-compat notes field: first error message, or null
    const notes = !isValid && errors.length > 0 ? errors.map((e) => `${e.field}: ${e.message}`).join(" · ") : null;

    return {
      valid: isValid,
      confidence,
      notes,
      formType: parsed.formType ?? null,
      formYear: parsed.formYear ?? null,
      errors,
      warnings,
    };
  } catch (e) {
    console.error("[ai-validation] Claude error:", e instanceof Error ? e.message : e);
    return { valid: true, confidence: 0, notes: null, formType: null, formYear: null, errors: [], warnings: [] };
  }
}
