"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { logAuditEvent } from "@/lib/auth/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const signInAction = async (locale: string, formData: FormData) => {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(`/${locale}/login?error=validation`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    await logAuditEvent({
      action: "auth.sign_in.failed",
      payload: { email: parsed.data.email.toLowerCase() },
    });
    redirect(`/${locale}/login?error=auth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await logAuditEvent({
    action: "auth.sign_in.succeeded",
    actorUserId: user?.id,
    payload: { email: parsed.data.email.toLowerCase() },
  });

  redirect(`/${locale}`);
};
