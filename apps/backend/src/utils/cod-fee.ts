/**
 * Cash on Delivery fee stored on shipping option metadata and applied
 * as a custom cart line item when COD payment is selected.
 */

export const COD_FEE_METADATA_KEY = "cod_fee"
export const COD_FEE_MODE_METADATA_KEY = "cod_fee_mode"
export const COD_FEE_TIERS_METADATA_KEY = "cod_fee_tiers"
export const COD_FEE_LINE_METADATA_KEY = "is_cod_fee"
export const COD_PAYMENT_PROVIDER_PREFIX = "pp_system_default"
export const COD_FEE_LINE_TITLE = "Cash on Delivery fee"

export const COD_FEE_MODES = ["flat", "tiers"] as const
export type CodFeeMode = (typeof COD_FEE_MODES)[number]

export type CodFeeTier = {
  /** Inclusive upper bound of the COD base amount; null = open-ended top bracket. */
  max_amount: number | null
  fee: number
}

export type CodFeeConfig = {
  mode: CodFeeMode
  flat_fee: number | null
  tiers: CodFeeTier[]
}

export function isCodPaymentProvider(providerId?: string | null): boolean {
  return !!providerId?.startsWith(COD_PAYMENT_PROVIDER_PREFIX)
}

function toNonNegativeNumber(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") {
    return null
  }
  const value = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    return null
  }
  return value
}

function toPositiveFee(raw: unknown): number | null {
  const value = toNonNegativeNumber(raw)
  if (value == null || value <= 0) {
    return null
  }
  return value
}

/** Legacy helper: flat fee only (positive). Kept for callers that only need a number. */
export function parseCodFee(
  metadata?: Record<string, unknown> | null
): number | null {
  return parseCodFeeConfig(metadata).flat_fee
}

export function parseCodFeeTier(raw: unknown): CodFeeTier[] {
  if (!Array.isArray(raw)) {
    return []
  }

  const tiers: CodFeeTier[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue
    }
    const row = entry as Record<string, unknown>
    const fee = toNonNegativeNumber(row.fee)
    if (fee == null) {
      continue
    }

    const maxRaw = row.max_amount
    let max_amount: number | null = null
    if (maxRaw !== undefined && maxRaw !== null && maxRaw !== "") {
      const parsed = toNonNegativeNumber(maxRaw)
      if (parsed == null) {
        continue
      }
      max_amount = parsed
    }

    tiers.push({ max_amount, fee })
  }

  return sortCodFeeTiers(tiers)
}

export function sortCodFeeTiers(tiers: CodFeeTier[]): CodFeeTier[] {
  return [...tiers].sort((a, b) => {
    if (a.max_amount == null && b.max_amount == null) {
      return 0
    }
    if (a.max_amount == null) {
      return 1
    }
    if (b.max_amount == null) {
      return -1
    }
    return a.max_amount - b.max_amount
  })
}

export function parseCodFeeConfig(
  metadata?: Record<string, unknown> | null
): CodFeeConfig {
  const flat_fee = metadata
    ? toPositiveFee(metadata[COD_FEE_METADATA_KEY])
    : null
  const tiers = metadata
    ? parseCodFeeTier(metadata[COD_FEE_TIERS_METADATA_KEY])
    : []

  const modeRaw = metadata?.[COD_FEE_MODE_METADATA_KEY]
  let mode: CodFeeMode = "flat"
  if (modeRaw === "tiers") {
    mode = "tiers"
  } else if (modeRaw === "flat") {
    mode = "flat"
  } else if (tiers.length > 0 && flat_fee == null) {
    // Implicit tiers if only tiers are present (no explicit mode).
    mode = "tiers"
  }

  return { mode, flat_fee, tiers }
}

/**
 * Pick the fee for a COD base amount from config.
 * Tiers: first bracket where amount <= max_amount; open-ended (null) last.
 */
export function resolveCodFeeFromConfig(
  config: CodFeeConfig,
  codBaseAmount: number
): number | null {
  if (!Number.isFinite(codBaseAmount) || codBaseAmount < 0) {
    return null
  }

  if (config.mode === "flat") {
    return config.flat_fee
  }

  const tiers = sortCodFeeTiers(config.tiers)
  if (tiers.length === 0) {
    return null
  }

  for (const tier of tiers) {
    if (tier.max_amount == null) {
      return tier.fee > 0 ? tier.fee : null
    }
    if (codBaseAmount <= tier.max_amount) {
      return tier.fee > 0 ? tier.fee : null
    }
  }

  return null
}

export function findCodFeeLineItem<
  T extends { id: string; metadata?: Record<string, unknown> | null },
>(items?: T[] | null): T | undefined {
  return items?.find(
    (item) => item.metadata?.[COD_FEE_LINE_METADATA_KEY] === true
  )
}

export type CodFeeConfigInput = {
  mode: CodFeeMode
  cod_fee: number | null
  cod_fee_tiers: CodFeeTier[]
}

/**
 * Validate and normalize an Admin update payload.
 * Throws Error with message on invalid input (caller maps to MedusaError).
 */
export function normalizeCodFeeConfigInput(
  input: CodFeeConfigInput
): CodFeeConfig {
  const mode = input.mode === "tiers" ? "tiers" : "flat"

  let flat_fee: number | null = null
  if (input.cod_fee != null) {
    if (!Number.isFinite(input.cod_fee) || input.cod_fee < 0) {
      throw new Error("cod_fee must be a non-negative number or null")
    }
    flat_fee = input.cod_fee > 0 ? input.cod_fee : null
  }

  const tiers = sortCodFeeTiers(
    (input.cod_fee_tiers ?? []).map((tier) => {
      if (!Number.isFinite(tier.fee) || tier.fee < 0) {
        throw new Error("Each tier fee must be a non-negative number")
      }
      if (
        tier.max_amount != null &&
        (!Number.isFinite(tier.max_amount) || tier.max_amount < 0)
      ) {
        throw new Error(
          "Each tier max_amount must be a non-negative number or null"
        )
      }
      return {
        max_amount: tier.max_amount ?? null,
        fee: tier.fee,
      }
    })
  )

  const openEnded = tiers.filter((t) => t.max_amount == null)
  if (openEnded.length > 1) {
    throw new Error("At most one open-ended tier (empty max amount) is allowed")
  }

  for (let i = 1; i < tiers.length; i++) {
    const prev = tiers[i - 1]
    const curr = tiers[i]
    if (prev.max_amount != null && curr.max_amount != null) {
      if (curr.max_amount <= prev.max_amount) {
        throw new Error("Tier max amounts must be strictly ascending")
      }
    }
  }

  if (mode === "tiers" && tiers.length === 0) {
    throw new Error("At least one tier is required when mode is tiers")
  }

  return { mode, flat_fee, tiers }
}

export function buildCodFeeMetadata(
  existing: Record<string, unknown> | null | undefined,
  config: CodFeeConfig
): Record<string, unknown> {
  const next = { ...(existing ?? {}) }

  next[COD_FEE_MODE_METADATA_KEY] = config.mode

  if (config.flat_fee == null || config.flat_fee <= 0) {
    delete next[COD_FEE_METADATA_KEY]
  } else {
    next[COD_FEE_METADATA_KEY] = config.flat_fee
  }

  if (config.tiers.length === 0) {
    delete next[COD_FEE_TIERS_METADATA_KEY]
  } else {
    next[COD_FEE_TIERS_METADATA_KEY] = sortCodFeeTiers(config.tiers).map(
      (tier) => ({
        max_amount: tier.max_amount,
        fee: tier.fee,
      })
    )
  }

  return next
}

/**
 * COD base for tier lookup: non-COD line item totals + shipping,
 * excluding the COD fee line itself.
 */
export function computeCodBaseAmount(input: {
  items?: Array<{
    total?: number | string | null
    subtotal?: number | string | null
    unit_price?: number | string | null
    quantity?: number | string | null
    metadata?: Record<string, unknown> | null
  }> | null
  shipping_total?: number | string | null
}): number {
  const items = input.items ?? []
  let itemsSum = 0

  for (const item of items) {
    if (item.metadata?.[COD_FEE_LINE_METADATA_KEY] === true) {
      continue
    }

    if (item.total != null) {
      const n = Number(item.total)
      if (Number.isFinite(n)) {
        itemsSum += n
        continue
      }
    }

    if (item.subtotal != null) {
      const n = Number(item.subtotal)
      if (Number.isFinite(n)) {
        itemsSum += n
        continue
      }
    }

    const unit = Number(item.unit_price ?? 0)
    const qty = Number(item.quantity ?? 1)
    if (Number.isFinite(unit) && Number.isFinite(qty)) {
      itemsSum += unit * qty
    }
  }

  const shipping = Number(input.shipping_total ?? 0)
  const shippingSafe = Number.isFinite(shipping) ? shipping : 0

  return Math.max(0, itemsSum + shippingSafe)
}
