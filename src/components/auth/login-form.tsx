type LoginFormProps = {
  emailLabel: string;
  passwordLabel: string;
  submitLabel: string;
  action: (formData: FormData) => void | Promise<void>;
};

export const LoginForm = ({ emailLabel, passwordLabel, submitLabel, action }: LoginFormProps) => {
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span>{emailLabel}</span>
        <input
          required
          name="email"
          type="email"
          className="rounded-md border border-blue-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>{passwordLabel}</span>
        <input
          required
          name="password"
          type="password"
          className="rounded-md border border-blue-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        {submitLabel}
      </button>
    </form>
  );
};
