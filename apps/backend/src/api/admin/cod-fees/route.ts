import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listCodFeeShippingOptions } from "./helpers"

/**
 * GET /admin/cod-fees
 *
 * Lists shipping options with their configured Cash on Delivery fees.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const result = await listCodFeeShippingOptions(req.scope)
  res.json(result)
}
