/**
 * AI-powered document validation for Israeli CPA forms (Claude vision only).
 *
 * Claude Sonnet reads the PDF/image directly and validates:
 *   1. Document identity — is this the expected form for the upload slot?
 *   2. Completeness / codes — Israeli Tax Authority / Bituach Leumi fields
 *      from the built-in CPA system prompt.
 *
 * OCR is deferred; this is a first-pass gate, not official Tax Authority certification.
 *
 * Returns structured JSON stored in uploaded_files.ai_result.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { Json } from "@/lib/supabase/database.types";

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
  /** Short Hebrew summary for UI */
  summary: string | null;
  /** Identified form type, e.g. "טופס 106", "טופס 101" */
  formType: string | null;
  /** Tax year found in the document */
  formYear: number | null;
  /** Hard errors — document is invalid */
  errors: ValidationError[];
  /** Soft warnings — document may be OK but needs attention */
  warnings: ValidationError[];
};

/** Shape persisted to uploaded_files.ai_result */
export function toAiResultJson(validation: AIValidationResult): Json {
  return {
    formType: validation.formType,
    formYear: validation.formYear,
    isValid: validation.valid,
    confidence: validation.confidence,
    errors: validation.errors,
    warnings: validation.warnings,
    summary: validation.summary,
  };
}

export function aiStatusFromValidation(validation: AIValidationResult): "valid" | "invalid" {
  return validation.valid ? "valid" : "invalid";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SUPPORTED_VISUAL_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Used when AI cannot run — never treat as "valid". */
function skip(reason: "no_api_key" | "unsupported_type" | "ai_error"): AIValidationResult {
  const messages: Record<typeof reason, string> = {
    no_api_key: "בדיקת AI לא הוגדרה — יש להגדיר מפתח Anthropic",
    unsupported_type: "סוג קובץ זה אינו נתמך לבדיקה אוטומטית",
    ai_error: "בדיקת AI נכשלה — יש להריץ בדיקה חוזרת",
  };
  return {
    valid: false,
    confidence: 0,
    notes: messages[reason],
    summary: messages[reason],
    formType: null,
    formYear: null,
    errors: [{ field: "AI", message: messages[reason] }],
    warnings: [],
  };
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert Israeli CPA (רואה חשבון) specializing in validating Israeli tax and social-security documents.

## Your task
Validate the document the user provides. Respond with ONLY a JSON object — no markdown, no prose.

## Output schema
{
  "formType": "string | null",   // e.g. "טופס 106", "טופס 101", "ביטוח לאומי 632", null if unrecognised
  "formYear": number | null,     // tax/calendar year found in the document, null if absent
  "isValid": boolean,
  "confidence": number,          // 0.0 – 1.0
  "summary": "string (Hebrew)",  // 1 short sentence summarizing the result
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
- Visual identity: title like "אישור על-פי תקנות מס הכנסה (ניכוי ממשכורת)" or "טופס 106"
- Required fields: מספר מעסיק (9 digits), תעודת זהות עובד (9 digits), שנת מס, שם עובד,
  שכר ברוטו (code 158/172), מס הכנסה שנוכה (code 042), ביטוח לאומי חלק עובד (code 045),
  מס בריאות (code 047)
- Also look for: חודשי עבודה, נקודות זיכוי, הפרשות פנסיה/גמל/השתלמות when present
- Calculations to sanity-check when readable:
  - ניכוי מס roughly consistent with gross income
  - BI employee share roughly consistent with NI rates
  - Health tax roughly consistent with published rates

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
- Not an official annual tax form — INVALID if the expected document is טופס 106

## Validation rules
1. **Identity first** — decide what the document actually is before checking fields.
2. **Israeli ID (ת.ז.)** — 9 digits; Luhn-style check when readable.
3. **Employer number (מספר מעסיק)** — 9 digits when required for the form.
4. **Dates** — Israeli format DD/MM/YYYY or YYYY; future dates are errors.
5. **Year match** — document year must match the expected year when a year is visible.
6. **Amounts** — positive numbers; unrealistically large values (>10M ₪) are warnings.
7. **Blank required fields** — error if a required field is empty when it should not be.
8. **Wrong document class** — insurance policy, bank statement, contract, payslip, or any
   non-matching form for the expected slot → isValid=false with a clear Hebrew error.

## Tone
All summary / error.message / warning.message values must be in Hebrew.
Be concise — max 15 words per message.
If the document is completely illegible, set isValid=false and add:
{ "field": "מסמך", "message": "המסמך אינו קריא או אינו טופס מס ישראלי מוכר" }.`;

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Validates an uploaded document with Claude vision.
 *
 * Never throws — a failed validation returns valid=false with an explanatory error.
 */
export async function validateUploadedDocument(params: {
  fileBuffer: ArrayBuffer;
  mimeType: string;
  documentName: string;
  year: number;
}): Promise<AIValidationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[ai-validation] ANTHROPIC_API_KEY not configured — skipping validation");
    return skip("no_api_key");
  }

  const { fileBuffer, mimeType, documentName, year } = params;

  if (!SUPPORTED_VISUAL_MIMES.has(mimeType)) {
    return skip("unsupported_type");
  }

  const typeCheckRules = `
## Expected document type (CRITICAL)
The client was asked to upload: "${documentName}" for tax year ${year}.

Rules:
1. First identify what the document actually is (formType).
2. If it is NOT "${documentName}" (or a clear equivalent of that form), you MUST set isValid=false and add an error:
   { "field": "סוג מסמך", "message": "המסמך שהועלה אינו ${documentName}" }
3. Insurance policies, bank statements, payslips, contracts, or any other document that is not the expected form are INVALID for this upload slot.
4. Do NOT mark isValid=true just because the file is readable or contains Hebrew text / ID numbers.
5. Only mark isValid=true when you are confident this IS the expected form AND required checks pass.
6. If the year is visible and differs from ${year}, add an error on field "שנת מס".
`;

  const effectiveSystemPrompt = `${SYSTEM_PROMPT}

${typeCheckRules}`;

  try {
    const anthropic = new Anthropic({ apiKey });

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

    const userContent: Anthropic.MessageParam["content"] = [
      docBlock,
      {
        type: "text",
        text: `המסמך שהלקוח אמור להגיש: "${documentName}"
שנת מס צפויה: ${year}

אנא בצע את הבדיקה המלאה וחזור עם JSON בלבד.`,
      },
    ];

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
      summary?: string | null;
      errors?: ValidationError[];
      warnings?: ValidationError[];
    };

    const parsed: ClaudeOutput = JSON.parse(json);

    const errors: ValidationError[] = Array.isArray(parsed.errors) ? parsed.errors : [];
    const warnings: ValidationError[] = Array.isArray(parsed.warnings) ? parsed.warnings : [];
    let isValid = parsed.isValid ?? errors.length === 0;
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.8;

    // Server-side safety: never accept empty formType as valid when a specific type was expected
    if (isValid && !parsed.formType && documentName.trim()) {
      isValid = false;
      errors.push({
        field: "סוג מסמך",
        message: `לא ניתן לזהות את המסמך כ${documentName}`,
      });
    }

    const summary =
      (typeof parsed.summary === "string" && parsed.summary.trim()) ||
      (!isValid && errors.length > 0
        ? errors.map((e) => `${e.field}: ${e.message}`).join(" · ")
        : isValid
          ? "המסמך תקין"
          : null);

    const notes = !isValid && errors.length > 0 ? errors.map((e) => `${e.field}: ${e.message}`).join(" · ") : summary;

    return {
      valid: isValid,
      confidence,
      notes,
      summary,
      formType: parsed.formType ?? null,
      formYear: parsed.formYear ?? null,
      errors,
      warnings,
    };
  } catch (e) {
    console.error("[ai-validation] Claude error:", e instanceof Error ? e.message : e);
    return skip("ai_error");
  }
}
