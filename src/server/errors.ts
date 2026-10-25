import { ZodError } from "zod";

export class BackendError extends Error {
  readonly code: string;
  readonly status: number;
  fields?: { field: string; message: string }[];
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "BackendError";
    this.code = code;
    this.status = status;
  }
}
export function clientError(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  if (error instanceof ZodError) {
    const invalid = new BackendError(
      "INVALID_INPUT",
      "Check the submitted fields.",
      400,
    );
    invalid.fields = error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return invalid;
  }
  const code = (error as { code?: string })?.code;
  if (code === "42501")
    return new BackendError(
      "FORBIDDEN",
      "You do not have access to this operation.",
      403,
    );
  if (code === "P0002")
    return new BackendError(
      "NOT_FOUND",
      "The requested record was not found.",
      404,
    );
  if (code === "23505" || code === "40001" || code === "40P01")
    return new BackendError(
      "CONFLICT",
      "This record changed or already exists. Reload and try again.",
      409,
    );
  if (
    code === "23514" ||
    code === "23503" ||
    code === "22007" ||
    code === "22008"
  )
    return new BackendError(
      "INVALID_STATE",
      "This change is not allowed. Check the dates, status and linked records.",
      422,
    );
  return new BackendError(
    "UNAVAILABLE",
    "The service is temporarily unavailable. Please try again.",
    503,
  );
}
