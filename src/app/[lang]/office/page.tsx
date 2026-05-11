import { getDictionary } from "@/i18n/get-dictionary";
import { requireUser } from "@/lib/auth/session";

export default async function OfficePage({ params }: PageProps<"/[lang]/office">) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  await requireUser(lang);

  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold">{dict.office.title}</h1>
      <p className="text-zinc-700">{dict.office.description}</p>
    </section>
  );
}
