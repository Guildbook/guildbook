/** A user-facing failure (bad state, conflict) as opposed to a bug. */
export class DomainError extends Error {
  /** The form field the failure is about, shown next to that field and in the form's error summary. */
  readonly field?: string;
  /** Other values the user can pick instead, such as free subdomains. */
  readonly suggestions?: string[];

  constructor(message: string, opts: { field?: string; suggestions?: string[] } = {}) {
    super(message);
    this.name = "DomainError";
    this.field = opts.field;
    this.suggestions = opts.suggestions;
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}
