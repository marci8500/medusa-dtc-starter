type FoxpostLockerInfo = {
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

/** Read Foxpost locker fields from order/cart metadata (admin-side helper). */
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

  return Object.values(info).some(Boolean) ? info : null
}
