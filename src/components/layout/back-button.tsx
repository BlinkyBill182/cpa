"use client";

import { usePathname, useRouter } from "next/navigation";

type BackButtonProps = {
  label: string;
};

const HOME_PATTERN = /^\/$/;

export const BackButton = ({ label }: BackButtonProps) => {
  const router = useRouter();
  const pathname = usePathname();

  if (HOME_PATTERN.test(pathname)) return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="cursor-pointer text-sm text-accent hover:text-foreground"
    >
      {label}
    </button>
  );
};
