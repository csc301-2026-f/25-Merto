
"use client";

import { useActionState } from "react";
import { CUSTOMER_FIELDS, type Rep } from "@/lib/deals";
import { createCustomer } from "./actions";

export function CreateCustomerForm({ reps }: { reps?: Rep[] }) {
  const [state, formAction, pending] = useActionState(createCustomer, undefined);

  const inputClass =
    "w-full max-w-md rounded-lg border border-zinc-300  px-3 py-2 text-black outline-none transition dark:border-zinc-600 dark:text-white";

  const selectClass =
    "w-full max-w-md rounded-lg border border-zinc-300  px-3 py-2 text-black outline-none transition dark:border-zinc-600 dark:text-white";

  return (
    <form
      action={formAction}
      className="rounded-xl bg-slate-100 p-6 text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
    >
      <div className="space-y-5">
        {CUSTOMER_FIELDS.map((f) => (
          <div
            key={f.name}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
          >
            <label
              htmlFor={f.name}
              className="w-40 shrink-0 font-semibold"
            >
              {f.label}:
            </label>

            {"options" in f ? (
              <select
                id={f.name}
                name={f.name}
                required={f.required}
                defaultValue={state?.values?.[f.name] ?? ""}
                disabled={pending}
                className={selectClass}
              >
                <option value="" disabled>
                  Select…
                </option>

                {f.options.map((option) => (
                  <option
                    key={option}
                    value={option}
                    className="bg-white text-black"
                  >
                    {option.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={f.name}
                name={f.name}
                required={f.required}
                maxLength={200}
                defaultValue={state?.values?.[f.name]}
                disabled={pending}
                className={inputClass}
              />
            )}
          </div>
        ))}
      </div>

      {state?.error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      {state?.success && (
        <p
          role="status"
          className="mt-5 rounded-lg bg-green-100 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300"
        >
          {state.success}
        </p>
      )}

      {state?.warning && (
        <p
          role="status"
          className="mt-5 rounded-lg bg-yellow-100 p-3 text-sm text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
        >
          {state.warning}
        </p>
      )}

      <p className="mt-5 text-sm opacity-70">
        Enter an email, a phone, or both.
      </p>

      <div className="mt-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        {reps ? (
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="repId" className="font-semibold">
              Assign to:
            </label>

            <select
              id="repId"
              name="repId"
              defaultValue={state?.values?.repId ?? ""}
              disabled={pending}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-black outline-none dark:border-zinc-600 dark:text-white"
            >
              <option value="" className="bg-white text-black">
                No rep (unassigned)
              </option>

              {reps.map((rep) => (
                <option
                  key={rep.id}
                  value={rep.id}
                  className="bg-white text-black"
                >
                  {rep.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-sm opacity-70">
            You will own this customer.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#d5bd91] hover:bg-[#e3cda6] px-5 py-2.5 font-semibold text-zinc-950 transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create customer"}
        </button>
      </div>
    </form>
  );
}
