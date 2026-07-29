import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updateCodFeeForShippingOption } from "../helpers"

type UpdateCodFeeBody = {
  cod_fee: number | null
}

/**
 * POST /admin/cod-fees/:shipping_option_id
 *
 * Updates metadata.cod_fee on a shipping option (preserves other metadata).
 */
export const POST = async (
  req: MedusaRequest<UpdateCodFeeBody>,
  res: MedusaResponse
) => {
  const { shipping_option_id } = req.params
  const { cod_fee } = req.validatedBody

  const shipping_option = await updateCodFeeForShippingOption(
    req.scope,
    shipping_option_id,
    cod_fee
  )

  res.json({ shipping_option })
}
