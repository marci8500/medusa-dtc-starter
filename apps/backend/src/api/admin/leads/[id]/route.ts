import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { retrieveLeadCart } from "../helpers"

/**
 * GET /admin/leads/:id
 *
 * Returns a single open lead cart. 404 if missing, completed, or not a lead.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params

  const lead = await retrieveLeadCart(req.scope, id)

  if (!lead) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Lead cart with id ${id} was not found`
    )
  }

  res.json({ lead })
}
