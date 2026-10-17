"use client";

import { useActionState } from "react";
import { CUSTOMER_FIELDS, REPS } from "@/lib/deals";
import { createCustomer } from "./actions";

export function CreateCustomerForm() {
  const [state, formAction, pending] = useActionState(createCustomer, undefined);

  return (
    <form action={formAction} className="rounded border-2 p-6">
      <div className="space-y-4">
        {CUSTOMER_FIELDS.map((f) => (
          <div key={f.name} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <label htmlFor={f.name} className="w-40 font-semibold">
              {f.label}:
            </label>
            <input
              id={f.name}
              name={f.name}
              required
              maxLength={200}
              defaultValue={state?.values?.[f.name]}
              disabled={pending}
              className="w-full max-w-md rounded border-2 px-2 py-1"
            />
          </div>
        ))}
      </div>

      {state?.error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p role="status" className="mt-4 text-sm text-green-700">
          {state.success}
        </p>
      )}

      <div className="mt-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="repId" className="font-semibold">
            Assign to:
          </label>
          <select
            id="repId"
            name="repId"
            defaultValue={state?.values?.repId ?? ""}
            disabled={pending}
            className="rounded border-2 px-2 py-1"
          >
            <option value="">No rep (unassigned)</option>
            {REPS.map((rep) => (
              <option key={rep.id} value={rep.id}>
                {rep.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded border-2 px-4 py-2 font-semibold disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create customer"}
        </button>
      </div>
    </form>
  );
}