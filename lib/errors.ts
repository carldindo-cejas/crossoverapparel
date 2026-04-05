export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    const msg = error.message;
    // Map known D1 UNIQUE constraint violations to user-friendly messages
    if (msg.includes("UNIQUE constraint failed: users.email")) {
      return new AppError("An account with this email already exists", 409, "EMAIL_TAKEN");
    }
    if (msg.includes("UNIQUE constraint failed: products.sku")) {
      return new AppError("A product with this SKU already exists", 409, "SKU_TAKEN");
    }
    if (msg.includes("UNIQUE constraint failed: products.slug")) {
      return new AppError("A product with this slug already exists", 409, "SLUG_TAKEN");
    }
    if (msg.includes("UNIQUE constraint failed: categories.slug")) {
      return new AppError("A category with this slug already exists", 409, "SLUG_TAKEN");
    }
    if (msg.includes("UNIQUE constraint failed: designer_assignments")) {
      return new AppError("This designer is already assigned to this order", 409, "ALREADY_ASSIGNED");
    }
    // Surface D1 / SQLite errors so the caller can see the real problem
    if (msg.includes("D1_ERROR") || msg.includes("SQLITE") || msg.includes("constraint")) {
      return new AppError(`Database error: ${msg}`, 500, "DB_ERROR");
    }
    // Do not forward raw error.message for other errors — may contain internals
    return new AppError("An internal error occurred", 500, "INTERNAL_ERROR");
  }

  return new AppError("Unexpected error", 500, "INTERNAL_ERROR");
}
