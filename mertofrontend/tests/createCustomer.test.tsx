import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCustomer } from "@/app/manager/create-customer/actions";
import { CreateCustomerForm } from "@/app/manager/create-customer/create-customer-form";
import { backendFetch } from "@/lib/api";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({ token: "rep-1", role: "rep", name: "Riley Rep" }),
}));
vi.mock("@/lib/api", () => ({
  backendFetch: vi.fn(),
  errorMessage: async (res: Response) => (await res.json()).error,
}));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function customer(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

const typed = { buyer: "Janet Doe", vehicleInterest: "2024 Civic", source: "walk_in", email: "jane@example.com" };

describe("createCustomer", () => {
  beforeEach(() => vi.mocked(backendFetch).mockReset());

  it("warns that the typed name was not saved when the email matches another buyer", async () => {
    vi.mocked(backendFetch).mockResolvedValue(
      json(201, { dealId: "deal-9", buyer: { name: "Jane Doe", existing: true, optedOut: false } }),
    );

    const state = await createCustomer(undefined, customer(typed));

    expect(state?.success).toBeUndefined();
    expect(state?.warning).toBe(
      'Added a new deal for Jane Doe (matched by email or phone). The name you entered, "Janet Doe", was not saved. Check that this is the same person.',
    );
  });

  it("asks for an email or a phone before calling the backend", async () => {
    const state = await createCustomer(undefined, customer({ ...typed, email: "" }));

    expect(state?.error).toBe("Please fill in an email or a phone.");
    expect(backendFetch).not.toHaveBeenCalled();
  });
});

describe("CreateCustomerForm", () => {
  it("shows the duplicate-email warning and keeps what was typed", async () => {
    vi.mocked(backendFetch).mockResolvedValue(
      json(201, { dealId: "deal-9", buyer: { name: "Jane Doe", existing: true, optedOut: false } }),
    );
    render(<CreateCustomerForm />);

    await userEvent.type(screen.getByLabelText("Customer name:"), typed.buyer);
    await userEvent.type(screen.getByLabelText("Car interest:"), typed.vehicleInterest);
    await userEvent.selectOptions(screen.getByLabelText("Source:"), typed.source);
    await userEvent.type(screen.getByLabelText("Email:"), typed.email);
    await userEvent.click(screen.getByRole("button", { name: "Create customer" }));

    expect(await screen.findByRole("status")).toHaveTextContent("matched by email or phone");
  });
});
