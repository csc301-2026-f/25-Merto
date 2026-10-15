export type Role = "rep" | "manager";

export type AuthResult =
  | { status: "ok"; token: string; role: Role }
  | { status: "invalid" }
  | { status: "error" }; // backend down, 500, etc.

export type FlagDecision = "confirmed_issue" | "false_positive" | "resolved";

export type ReviewStatus =
  | "not_evaluated" | "passed" | "flagged"
  | "confirmed_issue" | "resolved" | "false_positive";