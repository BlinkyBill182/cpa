export const parseRedirect = (error: unknown): string | null => {
  if (error instanceof Error && error.message.startsWith("REDIRECT:")) {
    return error.message.replace("REDIRECT:", "");
  }
  return null;
};

export const expectRedirectTo = (error: unknown, expectedPath: string) => {
  const path = parseRedirect(error);
  if (!path) throw new Error(`Expected redirect but got: ${String(error)}`);
  if (!path.includes(expectedPath)) {
    throw new Error(`Expected redirect to include "${expectedPath}" but got "${path}"`);
  }
};
