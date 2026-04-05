import { NextRequest } from "next/server";
import { ok, fail, parseJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getWorkerEnv } from "@/lib/env";
import { submitRating, getRating } from "@/services/rating.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const env = getWorkerEnv();
    const rating = await getRating(env, orderNumber);
    return ok(rating);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const customerPhone = request.headers.get("x-customer-phone")?.trim() ?? null;
    if (!customerPhone) {
      throw new AppError(
        "Phone verification required to submit a rating.",
        401,
        "VERIFICATION_REQUIRED"
      );
    }
    const payload = await parseJson(request, (v) => v);
    const env = getWorkerEnv();
    const result = await submitRating(env, orderNumber, payload, customerPhone);
    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
