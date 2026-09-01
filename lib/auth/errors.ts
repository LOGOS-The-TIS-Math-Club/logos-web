export class AccessDeniedError extends Error {
  constructor(readonly code: string) {
    super("Access denied");
    this.name = "AccessDeniedError";
  }
}
