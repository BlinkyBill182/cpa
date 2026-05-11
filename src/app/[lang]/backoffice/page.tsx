import { redirect } from "next/navigation";

export default async function BackofficePage({ params }: PageProps<"/[lang]/backoffice">) {
  const { lang } = await params;
  redirect(`/${lang}/backoffice/tenants`);
}
