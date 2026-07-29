import {
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"
import { z } from "@medusajs/framework/zod"
import { LEAD_STATUSES } from "../utils/lead-carts"

const leadStatusSchema = z.enum(
  LEAD_STATUSES as unknown as [string, ...string[]]
)

export const GetLeadsSchema = createFindParams().merge(
  z.object({
    q: z.string().optional(),
    status: leadStatusSchema.optional(),
  })
)

export const UpdateLeadStatusSchema = z.object({
  status: leadStatusSchema,
})

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
    {
      matcher: "/admin/leads/:id/status",
      method: "POST",
      middlewares: [validateAndTransformBody(UpdateLeadStatusSchema)],
    },
  ],
})
