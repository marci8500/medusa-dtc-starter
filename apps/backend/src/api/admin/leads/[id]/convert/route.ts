import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { convertLeadCartToDraftOrder } from "../../helpers"

/**
 * POST /admin/leads/:id/convert
 *
 * Creates a Medusa draft order from the lead cart, then marks the cart
 * completed so it disappears from the lead list.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params

  const result = await convertLeadCartToDraftOrder(req.scope, id)

  res.json(result)
}
