import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { successResponse } from "@/lib/api-response";
import { statsService } from "@/lib/services";

export const GET = withDbError(
  withAuth(async (req, { authUser }) => {
    const result = await statsService.getStats(authUser!);
    if (result instanceof Response) return result;
    return successResponse(result);
  })
);
