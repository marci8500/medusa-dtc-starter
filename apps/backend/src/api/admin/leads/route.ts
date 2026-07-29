import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isLeadStatus, type LeadStatus } from "../../../utils/lead-carts"
import { listLeadCarts } from "./helpers"

type LeadsQuery = {
  limit?: number
  offset?: number
  q?: string
  status?: string
}

/**
 * GET /admin/leads
 *
 * Lists incomplete carts that look like checkout leads (phone captured).
 * Auth: standard Admin session / JWT / secret API key.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = (req.validatedQuery ?? req.query) as LeadsQuery
  const status =
    typeof query.status === "string" && isLeadStatus(query.status)
      ? (query.status as LeadStatus)
      : undefined

  const result = await listLeadCarts(req.scope, {
    limit: query.limit != null ? Number(query.limit) : undefined,
    offset: query.offset != null ? Number(query.offset) : undefined,
    q: typeof query.q === "string" ? query.q : undefined,
    status,
  })

  res.json(result)
}
