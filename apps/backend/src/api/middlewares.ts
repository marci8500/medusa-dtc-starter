import {
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { LEAD_STATUSES } from "../utils/lead-carts"
import { syncCodFeeForCart } from "../utils/sync-cod-fee"

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

export const UpdateCodFeeSchema = z.object({
  mode: z.enum(["flat", "tiers"]),
  cod_fee: z.union([z.number(), z.null()]).optional().default(null),
  cod_fee_tiers: z
    .array(
      z.object({
        max_amount: z.union([z.number(), z.null()]),
        fee: z.number(),
      })
    )
    .optional()
    .default([]),
})

/**
 * Sync COD fee BEFORE payment session creation so the collection amount
 * includes the fee (refreshing after would delete the new session).
 */
async function syncCodFeeBeforePaymentSession(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const paymentCollectionId = req.params.id
  const providerId = (req.body as { provider_id?: string } | undefined)
    ?.provider_id

  if (!paymentCollectionId || !providerId) {
    return next()
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: paymentCollections } = await query.graph({
    entity: "payment_collection",
    fields: ["id", "cart.id"],
    filters: { id: paymentCollectionId },
  })

  const cartId = (
    paymentCollections?.[0] as { cart?: { id?: string } | null } | undefined
  )?.cart?.id

  if (cartId) {
    await syncCodFeeForCart(req.scope, cartId, { providerId })
  }

  return next()
}

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
    {
      matcher: "/admin/cod-fees/:shipping_option_id",
      method: "POST",
      middlewares: [validateAndTransformBody(UpdateCodFeeSchema)],
    },
    {
      matcher: "/store/payment-collections/:id/payment-sessions",
      method: "POST",
      middlewares: [syncCodFeeBeforePaymentSession],
    },
  ],
})
