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
          className="input-field"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>{passwordLabel}</span>
        <input
          required
          name="password"
          type="password"
          className="input-field"
        />
      </label>
      <button
        type="submit"
        className="btn-primary"
      >
        {submitLabel}
      </button>
    </form>
  );
};
