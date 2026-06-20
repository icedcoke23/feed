import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { successResponse } from "@/lib/api-response";
import { authService } from "@/lib/services";

export const GET = withDbError(
  withAuth(async (req, { authUser }) => {
    const result = await authService.getCurrentUser(authUser!.userId);
    if (result instanceof Response) return result;
    return successResponse(result);
  })
);
