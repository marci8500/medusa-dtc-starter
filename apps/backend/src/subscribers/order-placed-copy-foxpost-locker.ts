import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  extractFoxpostLocker,
  pickFoxpostLockerMetadata,
} from "../utils/foxpost-locker"

/**
 * If cart → order metadata copy missed Foxpost locker keys, copy them
 * from the linked cart after the order is placed.
 */
export default async function orderPlacedCopyFoxpostLocker({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "metadata", "cart.id", "cart.metadata"],
    filters: { id: data.id },
  })

  const order = orders?.[0] as
    | {
        id: string
        metadata?: Record<string, unknown> | null
        cart?: {
          id?: string
          metadata?: Record<string, unknown> | null
        } | null
      }
    | undefined

  if (!order) {
    return
  }

  if (extractFoxpostLocker(order.metadata)) {
    return
  }

  const fromCart = pickFoxpostLockerMetadata(order.cart?.metadata)
  if (Object.keys(fromCart).length === 0) {
    return
  }

  const orderModule = container.resolve(Modules.ORDER)
  await orderModule.updateOrders([
    {
      id: order.id,
      metadata: {
        ...(order.metadata ?? {}),
        ...fromCart,
      },
    },
  ])

  logger.info(
    `Copied Foxpost locker metadata from cart ${order.cart?.id} to order ${order.id}`
  )
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
