import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { forbiddenError } from "@/lib/api-error";
import { successResponse } from "@/lib/api-response";
import { dataService } from "@/lib/services";

export const GET = withDbError(
  withAuth(async (req, { authUser }) => {
    if (authUser!.userRole !== "admin") {
      return forbiddenError("仅管理员可访问");
    }

    const result = await dataService.exportAll();
    return successResponse(result);
  })
);
