import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { LeadStatus } from "../../../../../utils/lead-carts"
import { updateLeadStatus } from "../../helpers"

type UpdateLeadStatusBody = {
  status: LeadStatus
}

/**
 * POST /admin/leads/:id/status
 *
 * Updates metadata.lead_status on an open lead cart (preserves other metadata).
 */
export const POST = async (
  req: MedusaRequest<UpdateLeadStatusBody>,
  res: MedusaResponse
) => {
  const { id } = req.params
  const { status } = req.validatedBody

  const lead = await updateLeadStatus(req.scope, id, status)

  res.json({ lead })
}
