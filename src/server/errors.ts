/** A user-facing failure (bad state, conflict) as opposed to a bug. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}
