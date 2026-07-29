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
  cod_fee: z.union([z.number(), z.null()]),
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
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["id"],
    filters: {
      payment_collection: {
        id: paymentCollectionId,
      },
    },
  })

  const cartId = (carts?.[0] as { id?: string } | undefined)?.id

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
