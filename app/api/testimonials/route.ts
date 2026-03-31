import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { getTestimonials } from "@/services/rating.service";

export async function GET() {
  try {
    const env = getWorkerEnv();
    const testimonials = await getTestimonials(env);
    return ok(testimonials);
  } catch (error) {
    return fail(error);
  }
}
