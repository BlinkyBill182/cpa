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
      className="cursor-pointer text-sm text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200"
    >
      {label}
    </button>
  );
};
