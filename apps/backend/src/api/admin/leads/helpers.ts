import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  isOpenLeadCart,
  leadCartQueryFields,
  matchesLeadSearch,
  sanitizeAddressForDisplay,
  toLeadCartDTO,
  type LeadCartDTO,
  type LeadCartSource,
} from "../../../utils/lead-carts"

/** Max incomplete carts scanned when filtering leads in-memory */
const LEAD_SCAN_LIMIT = 5000

export type ListLeadCartsInput = {
  limit?: number
  offset?: number
  q?: string
}

export type ListLeadCartsResult = {
  leads: LeadCartDTO[]
  count: number
  limit: number
  offset: number
}

function decorateLead(cart: LeadCartSource): LeadCartDTO {
  const dto = toLeadCartDTO(cart)
  return {
    ...dto,
    shipping_address: sanitizeAddressForDisplay(dto.shipping_address),
    billing_address: sanitizeAddressForDisplay(dto.billing_address),
  }
}

export async function listLeadCarts(
  container: MedusaContainer,
  input: ListLeadCartsInput = {}
): Promise<ListLeadCartsResult> {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)
  const offset = Math.max(input.offset ?? 0, 0)
  const q = input.q?.trim() ?? ""

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: leadCartQueryFields,
    filters: {
      completed_at: null,
    },
    pagination: {
      skip: 0,
      take: LEAD_SCAN_LIMIT,
      order: {
        updated_at: "DESC",
      },
    },
  })

  let leads = (carts as LeadCartSource[]).filter(isOpenLeadCart)

  if (q) {
    leads = leads.filter((cart) => matchesLeadSearch(cart, q))
  }

  const count = leads.length
  const page = leads.slice(offset, offset + limit).map(decorateLead)

  return {
    leads: page,
    count,
    limit,
    offset,
  }
}

export async function retrieveLeadCart(
  container: MedusaContainer,
  id: string
): Promise<LeadCartDTO | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: leadCartQueryFields,
    filters: {
      id,
      completed_at: null,
    },
  })

  const cart = (carts as LeadCartSource[])[0]
  if (!cart || !isOpenLeadCart(cart)) {
    return null
  }

  return decorateLead(cart)
}
