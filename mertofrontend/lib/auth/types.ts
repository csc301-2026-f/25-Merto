export type Role = "rep" | "manager";

export type AuthResult =
  | { status: "ok"; token: string; role: Role }
  | { status: "invalid" }
  | { status: "error" }; // backend down, 500, etc.