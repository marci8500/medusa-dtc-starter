import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { syncCodFeeForCart } from "../utils/sync-cod-fee"

/**
 * Keep the COD fee line item in sync when shipping (or other cart details) change.
 * syncCodFeeForCart is idempotent, so the cart.updated it may emit is a no-op.
 */
export default async function cartUpdatedSyncCodFee({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    await syncCodFeeForCart(container, data.id)
  } catch (error) {
    logger.error(
      `COD fee sync on cart.updated failed for ${data.id}: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "cart.updated",
}
