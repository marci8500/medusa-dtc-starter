import {
  defineMiddlewares,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"
import { z } from "@medusajs/framework/zod"

export const GetLeadsSchema = createFindParams().merge(
  z.object({
    q: z.string().optional(),
  })
)

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/leads",
      method: "GET",
      middlewares: [
        validateAndTransformQuery(GetLeadsSchema, {
          defaults: [],
          isList: true,
          defaultLimit: 20,
        }),
      ],
    },
  ],
})
