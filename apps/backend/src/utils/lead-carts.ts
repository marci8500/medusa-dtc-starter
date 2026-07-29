/**
 * Storefront-agnostic lead cart contract.
 *
 * Any storefront can mark a checkout lead by setting cart metadata:
 *   metadata.lead_phone = "<phone>"
 *
 * Optionally mirror the phone on shipping/billing address.phone.
 * Completed carts (completed_at set or linked order) are excluded.
 *
 * Stable key — do not rename without coordinating storefronts:
 */
export const LEAD_PHONE_METADATA_KEY = "lead_phone" as const

/** Name / address placeholders used when only a phone is known yet */
export const PLACEHOLDER_TEXT_VALUES = new Set([
  "—",
  "–",
  "-",
  "",
  "n/a",
  "N/A",
  "NA",
])

export const PLACEHOLDER_POSTAL_VALUES = new Set(["0000", "00000", ""])

const LEAD_CART_FIELDS = [
  "id",
  "email",
  "currency_code",
  "metadata",
  "created_at",
  "updated_at",
  "completed_at",
  "total",
  "subtotal",
  "item_total",
  "shipping_address.*",
  "billing_address.*",
  "items.id",
  "items.title",
  "items.quantity",
  "items.thumbnail",
  "items.unit_price",
  "items.variant_sku",
  "order.id",
] as const

export type LeadCartFields = (typeof LEAD_CART_FIELDS)[number]

export const leadCartQueryFields: string[] = [...LEAD_CART_FIELDS]

export type LeadAddress = {
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  company?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  postal_code?: string | null
  country_code?: string | null
  province?: string | null
} | null

export type LeadCartSource = {
  id: string
  email?: string | null
  currency_code?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: string | Date | null
  updated_at?: string | Date | null
  completed_at?: string | Date | null
  total?: number | string | null
  subtotal?: number | string | null
  item_total?: number | string | null
  shipping_address?: LeadAddress
  billing_address?: LeadAddress
  items?: Array<{
    id?: string
    title?: string | null
    quantity?: number | null
    thumbnail?: string | null
    unit_price?: number | string | null
    variant_sku?: string | null
  }> | null
  order?: { id?: string | null } | null
}

export type LeadCartDTO = {
  id: string
  phone: string | null
  email: string | null
  customer_name: string | null
  item_count: number
  items_summary: string | null
  total: number | null
  currency_code: string | null
  updated_at: string | null
  created_at: string | null
  shipping_address: LeadAddress
  billing_address: LeadAddress
  items: NonNullable<LeadCartSource["items"]>
  metadata: Record<string, unknown> | null
}

function asTrimmed(value?: string | null): string | null {
  if (value == null) {
    return null
  }
  const trimmed = String(value).trim()
  return trimmed.length ? trimmed : null
}

export function isPlaceholderText(value?: string | null): boolean {
  const trimmed = asTrimmed(value)
  if (trimmed == null) {
    return true
  }
  return PLACEHOLDER_TEXT_VALUES.has(trimmed)
}

export function normalizePhone(value?: string | null): string | null {
  const trimmed = asTrimmed(value)
  if (trimmed == null || PLACEHOLDER_TEXT_VALUES.has(trimmed)) {
    return null
  }
  return trimmed
}

export function resolveLeadPhone(cart: LeadCartSource): string | null {
  const fromMetadata = normalizePhone(
    cart.metadata?.[LEAD_PHONE_METADATA_KEY] as string | undefined
  )
  if (fromMetadata) {
    return fromMetadata
  }

  return (
    normalizePhone(cart.shipping_address?.phone) ||
    normalizePhone(cart.billing_address?.phone)
  )
}

export function resolveCustomerName(cart: LeadCartSource): string | null {
  const first = isPlaceholderText(cart.shipping_address?.first_name)
    ? null
    : asTrimmed(cart.shipping_address?.first_name)
  const last = isPlaceholderText(cart.shipping_address?.last_name)
    ? null
    : asTrimmed(cart.shipping_address?.last_name)

  const name = [first, last].filter(Boolean).join(" ").trim()
  return name.length ? name : null
}

export function isOpenLeadCart(cart: LeadCartSource): boolean {
  if (cart.completed_at) {
    return false
  }
  if (cart.order?.id) {
    return false
  }
  return Boolean(resolveLeadPhone(cart))
}

export function matchesLeadSearch(cart: LeadCartSource, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) {
    return true
  }

  const phone = resolveLeadPhone(cart)?.toLowerCase() ?? ""
  const email = asTrimmed(cart.email)?.toLowerCase() ?? ""
  const name = resolveCustomerName(cart)?.toLowerCase() ?? ""

  return (
    phone.includes(needle) ||
    email.includes(needle) ||
    name.includes(needle) ||
    cart.id.toLowerCase().includes(needle)
  )
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") {
    return null
  }
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function computeFallbackTotal(cart: LeadCartSource): number | null {
  if (!cart.items?.length) {
    return null
  }
  let sum = 0
  let hasPrice = false
  for (const item of cart.items) {
    const unit = toNumber(item.unit_price)
    if (unit == null) {
      continue
    }
    hasPrice = true
    sum += unit * (item.quantity ?? 0)
  }
  return hasPrice ? sum : null
}

export function toLeadCartDTO(cart: LeadCartSource): LeadCartDTO {
  const items = cart.items ?? []
  const itemCount = items.reduce((acc, item) => acc + (item.quantity ?? 0), 0)
  const titles = items
    .map((item) => item.title)
    .filter((title): title is string => Boolean(title?.trim()))
  const itemsSummary =
    titles.length === 0
      ? null
      : titles.length <= 2
        ? titles.join(", ")
        : `${titles.slice(0, 2).join(", ")} +${titles.length - 2}`

  const total =
    toNumber(cart.total) ??
    toNumber(cart.item_total) ??
    toNumber(cart.subtotal) ??
    computeFallbackTotal(cart)

  return {
    id: cart.id,
    phone: resolveLeadPhone(cart),
    email: asTrimmed(cart.email),
    customer_name: resolveCustomerName(cart),
    item_count: itemCount,
    items_summary: itemsSummary,
    total,
    currency_code: asTrimmed(cart.currency_code),
    updated_at: cart.updated_at ? String(cart.updated_at) : null,
    created_at: cart.created_at ? String(cart.created_at) : null,
    shipping_address: cart.shipping_address ?? null,
    billing_address: cart.billing_address ?? null,
    items,
    metadata: (cart.metadata as Record<string, unknown> | null) ?? null,
  }
}

export function sanitizeAddressForDisplay(address: LeadAddress): LeadAddress {
  if (!address) {
    return null
  }

  return {
    ...address,
    first_name: isPlaceholderText(address.first_name)
      ? null
      : asTrimmed(address.first_name),
    last_name: isPlaceholderText(address.last_name)
      ? null
      : asTrimmed(address.last_name),
    address_1: isPlaceholderText(address.address_1)
      ? null
      : asTrimmed(address.address_1),
    address_2: isPlaceholderText(address.address_2)
      ? null
      : asTrimmed(address.address_2),
    city: isPlaceholderText(address.city) ? null : asTrimmed(address.city),
    postal_code: PLACEHOLDER_POSTAL_VALUES.has(
      asTrimmed(address.postal_code) ?? ""
    )
      ? null
      : asTrimmed(address.postal_code),
    phone: normalizePhone(address.phone),
    company: isPlaceholderText(address.company)
      ? null
      : asTrimmed(address.company),
  }
}
