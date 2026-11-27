import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/app/login/login-form";
import { login } from "@/app/login/actions";

vi.mock("@/app/login/actions", () => ({ login: vi.fn() }));

describe("LoginForm", () => {
  it("sends the username and password and shows the error it gets back", async () => {
    vi.mocked(login).mockResolvedValue({ error: "Username or password was incorrect.", username: "gm" });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Username"), "gm");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Username or password was incorrect.");
    const formData = vi.mocked(login).mock.calls[0][1];
    expect(formData.get("username")).toBe("gm");
    expect(formData.get("password")).toBe("wrong-password");
    // The username stays filled in so it does not have to be typed again.
    expect(screen.getByLabelText("Username")).toHaveValue("gm");
  });
});
