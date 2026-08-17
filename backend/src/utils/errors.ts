// AppError taxonomy. Every error thrown by the app extends AppError so the
// global error handler can map them to the right HTTP status + code.

export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;
  expose: boolean;

  constructor(opts: {
    message: string;
    status?: number;
    code?: string;
    details?: unknown;
    expose?: boolean;
  }) {
    super(opts.message);
    this.name = this.constructor.name;
    this.status = opts.status ?? 500;
    this.code = opts.code ?? "INTERNAL_ERROR";
    this.details = opts.details;
    this.expose = opts.expose ?? this.status < 500;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: unknown) {
    super({ message, status: 400, code: "BAD_REQUEST", details, expose: true });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super({ message, status: 422, code: "VALIDATION_ERROR", details, expose: true });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super({ message, status: 401, code: "UNAUTHORIZED", expose: true });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", details?: unknown) {
    super({ message, status: 403, code: "FORBIDDEN", details, expose: true });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super({ message, status: 404, code: "NOT_FOUND", expose: true });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", details?: unknown) {
    super({ message, status: 409, code: "CONFLICT", details, expose: true });
  }
}

export class InventoryUnavailableError extends AppError {
  constructor(details?: unknown) {
    super({
      message: "No inventory available for the selected dates.",
      status: 409,
      code: "INVENTORY_UNAVAILABLE",
      details,
      expose: true,
    });
  }
}

export class RoomUnavailableError extends AppError {
  constructor(details?: unknown) {
    super({
      message: "The selected room is not available.",
      status: 409,
      code: "ROOM_UNAVAILABLE",
      details,
      expose: true,
    });
  }
}

export class PolicyViolationError extends AppError {
  constructor(message: string, details?: unknown) {
    super({ message, status: 409, code: "POLICY_VIOLATION", details, expose: true });
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests") {
    super({ message, status: 429, code: "TOO_MANY_REQUESTS", expose: true });
  }
}

export class LockedError extends AppError {
  constructor(message = "Account locked. Try again later.") {
    super({ message, status: 423, code: "ACCOUNT_LOCKED", expose: true });
  }
}

export class PaymentError extends AppError {
  constructor(message = "Payment processing error") {
    super({ message, status: 402, code: "PAYMENT_ERROR", expose: true });
  }
}
