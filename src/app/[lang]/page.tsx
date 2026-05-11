import Link from "next/link";

import { getDictionary } from "@/i18n/get-dictionary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LocalizedHomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isOwner = false;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("is_platform_owner")
      .eq("id", user.id)
      .single();
    isOwner = data?.is_platform_owner ?? false;
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">{dict.home.title}</h1>
      <p className="max-w-3xl text-zinc-700">{dict.home.description}</p>
      <div className="flex flex-wrap gap-3">
        {!user ? (
          <Link
            href={`/${lang}/login`}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50"
          >
            {dict.nav.login}
          </Link>
        ) : (
          <>
            {isOwner ? (
              <Link
                href={`/${lang}/owner/tenants`}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50"
              >
                {dict.home.ownerAction}
              </Link>
            ) : null}
            <Link
              href={`/${lang}/office`}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium"
            >
              {dict.home.officeAction}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
