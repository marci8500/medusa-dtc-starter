/**
 * Cash on Delivery fee stored on shipping option metadata and applied
 * as a custom cart line item when COD payment is selected.
 */

export const COD_FEE_METADATA_KEY = "cod_fee"
export const COD_FEE_LINE_METADATA_KEY = "is_cod_fee"
export const COD_PAYMENT_PROVIDER_PREFIX = "pp_system_default"
export const COD_FEE_LINE_TITLE = "Cash on Delivery fee"

export function isCodPaymentProvider(providerId?: string | null): boolean {
  return !!providerId?.startsWith(COD_PAYMENT_PROVIDER_PREFIX)
}

export function parseCodFee(
  metadata?: Record<string, unknown> | null
): number | null {
  if (!metadata) {
    return null
  }

  const raw = metadata[COD_FEE_METADATA_KEY]
  if (raw === undefined || raw === null || raw === "") {
    return null
  }

  const value = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }

  return value
}

export function findCodFeeLineItem<
  T extends { id: string; metadata?: Record<string, unknown> | null },
>(items?: T[] | null): T | undefined {
  return items?.find((item) => item.metadata?.[COD_FEE_LINE_METADATA_KEY] === true)
}

export function buildCodFeeMetadata(
  existing: Record<string, unknown> | null | undefined,
  codFee: number | null
): Record<string, unknown> {
  const next = { ...(existing ?? {}) }

  if (codFee == null || codFee <= 0) {
    delete next[COD_FEE_METADATA_KEY]
  } else {
    next[COD_FEE_METADATA_KEY] = codFee
  }

  return next
}
