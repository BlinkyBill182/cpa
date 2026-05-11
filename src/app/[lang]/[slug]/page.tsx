import { notFound } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ClientPortalPageProps = {
  params: Promise<{ lang: string; slug: string }>;
};

export default async function ClientPortalPage({ params }: ClientPortalPageProps) {
  const { slug } = await params;
  const admin = createSupabaseAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("name")
    .eq("slug", slug)
    .single();

  if (!tenant) notFound();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold">{tenant.name}</h1>
      <p className="text-zinc-600">Client portal coming soon.</p>
    </section>
  );
}
