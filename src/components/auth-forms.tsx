"use client";

import { useActionState } from "react";
import { login, signup } from "@/app/actions/auth";
import { Field, FormMessage } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/form";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <FormMessage ok={state.ok} message={state.message} />
      <Field label="E-mail" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.errors?.email} />
      <Field label="Mot de passe" name="password" type="password" autoComplete="current-password" required error={state.errors?.password} />
      <SubmitButton className="w-full" pendingLabel="Connexion…">Se connecter</SubmitButton>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState<FormState, FormData>(signup, {});
  return (
    <form action={action} className="space-y-4">
      <FormMessage ok={state.ok} message={state.message} />
      <Field label="Nom" name="name" autoComplete="name" required defaultValue={state.values?.name} error={state.errors?.name} />
      <Field label="E-mail" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.errors?.email} />
      <Field
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        required
        hint="10 caractères minimum."
        error={state.errors?.password}
      />
      <SubmitButton className="w-full" pendingLabel="Création…">Créer mon compte</SubmitButton>
    </form>
  );
}
