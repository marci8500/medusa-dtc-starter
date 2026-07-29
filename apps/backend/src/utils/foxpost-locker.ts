/**
 * Foxpost locker fields stored on cart/order metadata by the storefront.
 * Stable keys — keep in sync with Cellashop checkout (completeShippingStep).
 */
export const FOXPOST_LOCKER_METADATA_KEYS = [
  "foxpost_locker_id",
  "foxpost_locker_name",
  "foxpost_locker_address",
  "foxpost_place_id",
] as const

export type FoxpostLockerMetadataKey =
  (typeof FOXPOST_LOCKER_METADATA_KEYS)[number]

export type FoxpostLockerInfo = {
  locker_id: string | null
  locker_name: string | null
  locker_address: string | null
  place_id: string | null
}

function asString(value: unknown): string | null {
  if (value == null) {
    return null
  }
  const trimmed = String(value).trim()
  return trimmed.length ? trimmed : null
}

export function extractFoxpostLocker(
  metadata?: Record<string, unknown> | null
): FoxpostLockerInfo | null {
  if (!metadata) {
    return null
  }

  const info: FoxpostLockerInfo = {
    locker_id: asString(metadata.foxpost_locker_id),
    locker_name: asString(metadata.foxpost_locker_name),
    locker_address: asString(metadata.foxpost_locker_address),
    place_id: asString(metadata.foxpost_place_id),
  }

  const hasAny = Object.values(info).some(Boolean)
  return hasAny ? info : null
}

export function pickFoxpostLockerMetadata(
  metadata?: Record<string, unknown> | null
): Record<string, string> {
  const info = extractFoxpostLocker(metadata)
  if (!info) {
    return {}
  }

  const picked: Record<string, string> = {}
  if (info.locker_id) {
    picked.foxpost_locker_id = info.locker_id
  }
  if (info.locker_name) {
    picked.foxpost_locker_name = info.locker_name
  }
  if (info.locker_address) {
    picked.foxpost_locker_address = info.locker_address
  }
  if (info.place_id) {
    picked.foxpost_place_id = info.place_id
  }
  return picked
}
