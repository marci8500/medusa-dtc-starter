import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { CodFeeConfigInput } from "../../../../utils/cod-fee"
import { updateCodFeeForShippingOption } from "../helpers"

/**
 * POST /admin/cod-fees/:shipping_option_id
 *
 * Updates COD fee config on a shipping option (preserves other metadata).
 */
export const POST = async (
  req: MedusaRequest<CodFeeConfigInput>,
  res: MedusaResponse
) => {
  const { shipping_option_id } = req.params
  const body = req.validatedBody

  const shipping_option = await updateCodFeeForShippingOption(
    req.scope,
    shipping_option_id,
    body
  )

  res.json({ shipping_option })
}
