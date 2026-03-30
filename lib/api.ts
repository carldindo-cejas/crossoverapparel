import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, toAppError } from "@/lib/errors";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request input",
          issues: error.issues
        }
      },
      { status: 422 }
    );
  }

  const appError = toAppError(error);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: appError.code,
        message: appError.message
      }
    },
    { status: appError.statusCode }
  );
}

export async function parseJson<T>(request: Request, parser: (value: unknown) => T) {
  const body = await request.json();
  return parser(body);
}

export function assert(condition: unknown, message: string, statusCode = 400, code = "BAD_REQUEST") {
  if (!condition) {
    throw new AppError(message, statusCode, code);
  }
}
