import { z } from "zod";
import { withDbError } from "@/lib/route-handlers/with-db-error";
import { withAuth } from "@/lib/route-handlers/with-auth";
import { withValidation } from "@/lib/route-handlers/with-validation";
import { successResponse } from "@/lib/api-response";
import { homeService } from "@/lib/services";

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const GET = withDbError(
  withAuth(
    withValidation(
      { query: querySchema },
      async (req, { authUser, query }) => {
        const result = await homeService.getHomeData(
          authUser!,
          query as homeService.HomeDataQuery
        );
        if (result instanceof Response) return result;
        return successResponse(result);
      }
    )
  )
);
