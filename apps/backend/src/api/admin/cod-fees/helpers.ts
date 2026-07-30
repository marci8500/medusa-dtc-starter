import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  buildCodFeeMetadata,
  normalizeCodFeeConfigInput,
  parseCodFeeConfig,
  type CodFeeConfigInput,
  type CodFeeMode,
  type CodFeeTier,
} from "../../../utils/cod-fee"

export type CodFeeShippingOptionDTO = {
  id: string
  name: string
  type_code: string | null
  type_label: string | null
  provider_id: string | null
  cod_fee_mode: CodFeeMode
  cod_fee: number | null
  cod_fee_tiers: CodFeeTier[]
}

type ShippingOptionSource = {
  id: string
  name?: string | null
  provider_id?: string | null
  metadata?: Record<string, unknown> | null
  type?: {
    code?: string | null
    label?: string | null
  } | null
}

function toDto(option: ShippingOptionSource): CodFeeShippingOptionDTO {
  const config = parseCodFeeConfig(option.metadata)
  return {
    id: option.id,
    name: option.name ?? option.id,
    type_code: option.type?.code ?? null,
    type_label: option.type?.label ?? null,
    provider_id: option.provider_id ?? null,
    cod_fee_mode: config.mode,
    cod_fee: config.flat_fee,
    cod_fee_tiers: config.tiers,
  }
}

const SHIPPING_OPTION_FIELDS = [
  "id",
  "name",
  "provider_id",
  "metadata",
  "type.code",
  "type.label",
] as const

export async function listCodFeeShippingOptions(
  container: MedusaContainer
): Promise<{ shipping_options: CodFeeShippingOptionDTO[] }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "shipping_option",
    fields: [...SHIPPING_OPTION_FIELDS],
  })

  const shipping_options = ((data ?? []) as ShippingOptionSource[])
    .map(toDto)
    .sort((a, b) => a.name.localeCompare(b.name))

  return { shipping_options }
}

export async function updateCodFeeForShippingOption(
  container: MedusaContainer,
  shippingOptionId: string,
  input: CodFeeConfigInput
): Promise<CodFeeShippingOptionDTO> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "shipping_option",
    fields: [...SHIPPING_OPTION_FIELDS],
    filters: { id: shippingOptionId },
  })

  const option = (data?.[0] as ShippingOptionSource | undefined) ?? undefined
  if (!option) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Shipping option ${shippingOptionId} was not found`
    )
  }

  let config
  try {
    config = normalizeCodFeeConfigInput(input)
  } catch (error) {
    if (error instanceof MedusaError) {
      throw error
    }
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      error instanceof Error ? error.message : String(error)
    )
  }

  const fulfillment = container.resolve(Modules.FULFILLMENT)
  await fulfillment.upsertShippingOptions([
    {
      id: shippingOptionId,
      metadata: buildCodFeeMetadata(option.metadata, config),
    } as { id: string },
  ])

  const { data: refreshed } = await query.graph({
    entity: "shipping_option",
    fields: [...SHIPPING_OPTION_FIELDS],
    filters: { id: shippingOptionId },
  })

  const updated = refreshed?.[0] as ShippingOptionSource | undefined
  if (!updated) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Shipping option ${shippingOptionId} was not found after update`
    )
  }

  return toDto(updated)
}
