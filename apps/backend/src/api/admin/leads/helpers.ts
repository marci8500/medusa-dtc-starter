import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  OrderStatus,
} from "@medusajs/framework/utils"
import { createOrderWorkflow } from "@medusajs/medusa/core-flows"
import {
  buildLeadStatusMetadata,
  isOpenLeadCart,
  leadCartQueryFields,
  matchesLeadSearch,
  resolveLeadPhone,
  resolveLeadStatus,
  sanitizeAddressForDisplay,
  toLeadCartDTO,
  type LeadAddress,
  type LeadCartDTO,
  type LeadCartSource,
  type LeadStatus,
} from "../../../utils/lead-carts"

/** Max incomplete carts scanned when filtering leads in-memory */
const LEAD_SCAN_LIMIT = 5000

export type ListLeadCartsInput = {
  limit?: number
  offset?: number
  q?: string
  status?: LeadStatus
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

function mapAddressForDraft(address?: LeadAddress) {
  if (!address) {
    return undefined
  }

  return {
    first_name: address.first_name ?? undefined,
    last_name: address.last_name ?? undefined,
    phone: address.phone ?? undefined,
    company: address.company ?? undefined,
    address_1: address.address_1 ?? undefined,
    address_2: address.address_2 ?? undefined,
    city: address.city ?? undefined,
    country_code: address.country_code ?? undefined,
    province: address.province ?? undefined,
    postal_code: address.postal_code ?? undefined,
  }
}

async function loadOpenLeadCartSource(
  container: MedusaContainer,
  id: string
): Promise<LeadCartSource | null> {
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

  return cart
}

export async function listLeadCarts(
  container: MedusaContainer,
  input: ListLeadCartsInput = {}
): Promise<ListLeadCartsResult> {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)
  const offset = Math.max(input.offset ?? 0, 0)
  const q = input.q?.trim() ?? ""
  const status = input.status

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

  if (status) {
    leads = leads.filter((cart) => resolveLeadStatus(cart) === status)
  }

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
  const cart = await loadOpenLeadCartSource(container, id)
  return cart ? decorateLead(cart) : null
}

export async function updateLeadStatus(
  container: MedusaContainer,
  id: string,
  status: LeadStatus
): Promise<LeadCartDTO> {
  const cart = await loadOpenLeadCartSource(container, id)
  if (!cart) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Lead cart with id ${id} was not found`
    )
  }

  const cartModule = container.resolve(Modules.CART)
  await cartModule.updateCarts([
    {
      id: cart.id,
      metadata: buildLeadStatusMetadata(cart.metadata, status),
    },
  ])

  const updated = await retrieveLeadCart(container, id)
  if (!updated) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Lead cart with id ${id} was not found after status update`
    )
  }

  return updated
}

export type ConvertLeadResult = {
  draft_order_id: string
  order_id: string
  lead: LeadCartDTO
}

export async function convertLeadCartToDraftOrder(
  container: MedusaContainer,
  id: string
): Promise<ConvertLeadResult> {
  const cart = await loadOpenLeadCartSource(container, id)
  if (!cart) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Lead cart with id ${id} was not found`
    )
  }

  if (!cart.region_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Lead cart ${id} is missing region_id and cannot be converted`
    )
  }

  const items = (cart.items ?? [])
    .filter((item) => (item.quantity ?? 0) > 0)
    .map((item) => {
      const unitPrice = Number(item.unit_price ?? 0)
      return {
        title: item.title ?? item.product_title ?? "Item",
        variant_id: item.variant_id ?? undefined,
        variant_sku: item.variant_sku ?? undefined,
        unit_price: Number.isFinite(unitPrice) ? unitPrice : 0,
        quantity: item.quantity ?? 1,
        metadata: {
          ...(item.metadata ?? {}),
          source_cart_item_id: item.id,
          source_cart_id: cart.id,
        },
      }
    })

  if (items.length === 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Lead cart ${id} has no line items to convert`
    )
  }

  const phone = resolveLeadPhone(cart)
  // Mirrors POST /admin/draft-orders — CreateOrderWorkflowInput typings omit draft flags.
  const workflowInput = {
    region_id: cart.region_id,
    sales_channel_id: cart.sales_channel_id ?? undefined,
    customer_id: cart.customer_id ?? undefined,
    email: cart.email ?? undefined,
    currency_code: cart.currency_code ?? undefined,
    shipping_address: mapAddressForDraft(cart.shipping_address),
    billing_address: mapAddressForDraft(cart.billing_address),
    items,
    metadata: {
      ...(cart.metadata ?? {}),
      source_lead_cart_id: cart.id,
      lead_phone: phone,
    },
    status: OrderStatus.DRAFT,
    is_draft_order: true,
    no_notification: true,
  }

  const { result } = await createOrderWorkflow(container).run({
    input: workflowInput as never,
  })

  const cartModule = container.resolve(Modules.CART)
  await cartModule.updateCarts([
    {
      id: cart.id,
      completed_at: new Date(),
      metadata: {
        ...(cart.metadata ?? {}),
        converted_draft_order_id: result.id,
      },
    },
  ])

  const lead = decorateLead({
    ...cart,
    completed_at: new Date(),
    metadata: {
      ...(cart.metadata ?? {}),
      converted_draft_order_id: result.id,
    },
  })

  return {
    draft_order_id: result.id,
    order_id: result.id,
    lead,
  }
}
