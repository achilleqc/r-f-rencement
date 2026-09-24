"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { refreshProspect, updateProspect } from "@/app/actions/prospects";
import { PROSPECT_STATUSES, STATUS_LABELS, type ProspectStatus } from "@/lib/prospect-status";
import { FormMessage } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/form";

export function ProspectFollowUpForm({
  id,
  status,
  notes,
  followUpAt,
}: {
  id: string;
  status: ProspectStatus;
  notes: string;
  followUpAt: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(updateProspect, {});
  const values = state.values;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="status" className="label">Statut</label>
          <select id="status" name="status" defaultValue={values?.status ?? status} className="field">
            {PROSPECT_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="followUpAt" className="label">Date de relance</label>
          <input id="followUpAt" name="followUpAt" type="date" defaultValue={values?.followUpAt ?? followUpAt} className="field" />
          {state.errors?.followUpAt && <p className="mt-1.5 text-sm text-danger">{state.errors.followUpAt}</p>}
        </div>
      </div>
      <div>
        <label htmlFor="notes" className="label">Notes</label>
        <textarea
          id="notes"
          name="notes"
          rows={6}
          defaultValue={values?.notes ?? notes}
          placeholder="Nom du gérant, meilleur moment pour appeler, besoins, devis envoyé…"
          className="field min-h-32 resize-y"
        />
        {state.errors?.notes && <p className="mt-1.5 text-sm text-danger">{state.errors.notes}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
        <FormMessage ok={state.ok} message={state.message} />
      </div>
    </form>
  );
}

export function RefreshProspectForm({ id }: { id: string }) {
  const [state, action] = useActionState<FormState, FormData>(refreshProspect, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="secondary" className="btn-sm" pendingLabel="Actualisation…">
        <RefreshCw className="size-3.5" /> Actualiser les informations
      </SubmitButton>
      {state.message && <span className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</span>}
    </form>
  );
}
