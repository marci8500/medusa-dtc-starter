import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  buildCodFeeMetadata,
  parseCodFee,
} from "../../../utils/cod-fee"

export type CodFeeShippingOptionDTO = {
  id: string
  name: string
  type_code: string | null
  type_label: string | null
  provider_id: string | null
  cod_fee: number | null
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
  return {
    id: option.id,
    name: option.name ?? option.id,
    type_code: option.type?.code ?? null,
    type_label: option.type?.label ?? null,
    provider_id: option.provider_id ?? null,
    cod_fee: parseCodFee(option.metadata),
  }
}

export async function listCodFeeShippingOptions(
  container: MedusaContainer
): Promise<{ shipping_options: CodFeeShippingOptionDTO[] }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "shipping_option",
    fields: [
      "id",
      "name",
      "provider_id",
      "metadata",
      "type.code",
      "type.label",
    ],
  })

  const shipping_options = ((data ?? []) as ShippingOptionSource[])
    .map(toDto)
    .sort((a, b) => a.name.localeCompare(b.name))

  return { shipping_options }
}

export async function updateCodFeeForShippingOption(
  container: MedusaContainer,
  shippingOptionId: string,
  codFee: number | null
): Promise<CodFeeShippingOptionDTO> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "shipping_option",
    fields: [
      "id",
      "name",
      "provider_id",
      "metadata",
      "type.code",
      "type.label",
    ],
    filters: { id: shippingOptionId },
  })

  const option = (data?.[0] as ShippingOptionSource | undefined) ?? undefined
  if (!option) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Shipping option ${shippingOptionId} was not found`
    )
  }

  if (codFee != null && (!Number.isFinite(codFee) || codFee < 0)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "cod_fee must be a non-negative number or null"
    )
  }

  const normalizedFee = codFee != null && codFee > 0 ? codFee : null

  const fulfillment = container.resolve(Modules.FULFILLMENT)
  await fulfillment.upsertShippingOptions([
    {
      id: shippingOptionId,
      metadata: buildCodFeeMetadata(option.metadata, normalizedFee),
    } as { id: string },
  ])

  const { data: refreshed } = await query.graph({
    entity: "shipping_option",
    fields: [
      "id",
      "name",
      "provider_id",
      "metadata",
      "type.code",
      "type.label",
    ],
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
