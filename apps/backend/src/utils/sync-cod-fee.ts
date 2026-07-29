import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MathBN,
} from "@medusajs/framework/utils"
import {
  addToCartWorkflow,
  deleteLineItemsWorkflow,
  updateLineItemInCartWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  COD_FEE_LINE_METADATA_KEY,
  COD_FEE_LINE_TITLE,
  findCodFeeLineItem,
  isCodPaymentProvider,
  parseCodFee,
} from "./cod-fee"

type CartForCodSync = {
  id: string
  items?: Array<{
    id: string
    unit_price?: number | string | null
    metadata?: Record<string, unknown> | null
  }> | null
  shipping_methods?: Array<{
    shipping_option_id?: string | null
    shipping_option?: {
      id?: string
      metadata?: Record<string, unknown> | null
    } | null
  }> | null
  payment_collection?: {
    payment_sessions?: Array<{
      provider_id?: string | null
      status?: string | null
    }> | null
  } | null
}

export type SyncCodFeeOptions = {
  /** Prefer this provider over sessions already on the cart (e.g. about to be created). */
  providerId?: string | null
}

function activeProviderId(cart: CartForCodSync): string | null | undefined {
  const sessions = cart.payment_collection?.payment_sessions ?? []
  const active = sessions.find((session) =>
    ["pending", "requires_more", "authorized", "captured"].includes(
      session.status ?? "pending"
    )
  )
  return active?.provider_id ?? sessions[0]?.provider_id
}

function unitPriceEquals(
  left: number | string | null | undefined,
  right: number
): boolean {
  if (left == null) {
    return false
  }
  try {
    return MathBN.eq(left, right)
  } catch {
    return Number(left) === right
  }
}

async function resolveShippingOptionCodFee(
  container: MedusaContainer,
  cart: CartForCodSync
): Promise<number | null> {
  const method = cart.shipping_methods?.[0]
  if (!method) {
    return null
  }

  const fromLink = parseCodFee(method.shipping_option?.metadata)
  if (fromLink != null) {
    return fromLink
  }

  const optionId = method.shipping_option_id ?? method.shipping_option?.id
  if (!optionId) {
    return null
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: optionsList } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "metadata"],
    filters: { id: optionId },
  })

  const option = optionsList?.[0] as
    | { metadata?: Record<string, unknown> | null }
    | undefined

  return parseCodFee(option?.metadata)
}

/**
 * Ensures the cart has the correct COD fee line item for the selected
 * courier (shipping option) and COD payment method. Idempotent.
 */
export async function syncCodFeeForCart(
  container: MedusaContainer,
  cartId: string,
  options?: SyncCodFeeOptions
): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "items.id",
      "items.unit_price",
      "items.metadata",
      "shipping_methods.shipping_option_id",
      "shipping_methods.shipping_option.id",
      "shipping_methods.shipping_option.metadata",
      "payment_collection.payment_sessions.provider_id",
      "payment_collection.payment_sessions.status",
    ],
    filters: { id: cartId },
  })

  const cart = carts?.[0] as CartForCodSync | undefined
  if (!cart) {
    return
  }

  const providerId =
    options?.providerId !== undefined
      ? options.providerId
      : activeProviderId(cart)

  const isCod = isCodPaymentProvider(providerId)
  const desiredFee = isCod
    ? await resolveShippingOptionCodFee(container, cart)
    : null

  const existing = findCodFeeLineItem(cart.items)

  try {
    if (desiredFee == null) {
      if (existing) {
        await deleteLineItemsWorkflow(container).run({
          input: {
            cart_id: cartId,
            ids: [existing.id],
          },
        })
      }
      return
    }

    if (existing) {
      if (unitPriceEquals(existing.unit_price, desiredFee)) {
        return
      }

      await updateLineItemInCartWorkflow(container).run({
        input: {
          cart_id: cartId,
          item_id: existing.id,
          update: {
            unit_price: desiredFee,
            quantity: 1,
            metadata: {
              ...(existing.metadata ?? {}),
              [COD_FEE_LINE_METADATA_KEY]: true,
            },
          },
        },
      })
      return
    }

    await addToCartWorkflow(container).run({
      input: {
        cart_id: cartId,
        items: [
          {
            title: COD_FEE_LINE_TITLE,
            quantity: 1,
            unit_price: desiredFee,
            requires_shipping: false,
            is_discountable: false,
            metadata: {
              [COD_FEE_LINE_METADATA_KEY]: true,
            },
          },
        ],
      },
    })
  } catch (error) {
    logger.error(
      `Failed to sync COD fee for cart ${cartId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    throw error
  }
}
