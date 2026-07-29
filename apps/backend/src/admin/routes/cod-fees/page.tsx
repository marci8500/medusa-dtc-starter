import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Button,
  Container,
  Heading,
  Input,
  Select,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState, Fragment } from "react"
import { useTranslation } from "react-i18next"
import { adminFetch } from "../../lib/client"

type CodFeeMode = "flat" | "tiers"

type CodFeeTier = {
  max_amount: number | null
  fee: number
}

type CodFeeShippingOption = {
  id: string
  name: string
  type_code: string | null
  type_label: string | null
  provider_id: string | null
  cod_fee_mode: CodFeeMode
  cod_fee: number | null
  cod_fee_tiers: CodFeeTier[]
}

type CodFeesResponse = {
  shipping_options: CodFeeShippingOption[]
}

type UpdateCodFeeResponse = {
  shipping_option: CodFeeShippingOption
}

type DraftTier = {
  max_amount: string
  fee: string
}

type DraftConfig = {
  mode: CodFeeMode
  flat_fee: string
  tiers: DraftTier[]
}

function feeInputValue(fee: number | null): string {
  return fee == null ? "" : String(fee)
}

function toDraft(option: CodFeeShippingOption): DraftConfig {
  return {
    mode: option.cod_fee_mode,
    flat_fee: feeInputValue(option.cod_fee),
    tiers:
      option.cod_fee_tiers.length > 0
        ? option.cod_fee_tiers.map((tier) => ({
            max_amount:
              tier.max_amount == null ? "" : String(tier.max_amount),
            fee: String(tier.fee),
          }))
        : [{ max_amount: "", fee: "" }],
  }
}

function parseNonNegative(
  raw: string,
  allowEmptyAsNull: boolean
): number | null | undefined {
  const trimmed = raw.trim()
  if (trimmed === "") {
    return allowEmptyAsNull ? null : undefined
  }
  const value = Number(trimmed.replace(",", "."))
  if (!Number.isFinite(value) || value < 0) {
    return undefined
  }
  return value
}

function draftsEqual(a: DraftConfig, b: DraftConfig): boolean {
  if (a.mode !== b.mode || a.flat_fee.trim() !== b.flat_fee.trim()) {
    return false
  }
  if (a.tiers.length !== b.tiers.length) {
    return false
  }
  return a.tiers.every(
    (tier, i) =>
      tier.max_amount.trim() === b.tiers[i].max_amount.trim() &&
      tier.fee.trim() === b.tiers[i].fee.trim()
  )
}

const CodFeesPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState<Record<string, DraftConfig>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-cod-fees"],
    queryFn: () => adminFetch<CodFeesResponse>("/admin/cod-fees"),
  })

  const options = data?.shipping_options ?? []

  useEffect(() => {
    if (!data?.shipping_options) {
      return
    }
    setDrafts((current) => {
      const next: Record<string, DraftConfig> = {}
      for (const option of data.shipping_options) {
        next[option.id] = current[option.id] ?? toDraft(option)
      }
      return next
    })
  }, [data])

  const saveMutation = useMutation({
    mutationFn: ({
      id,
      mode,
      cod_fee,
      cod_fee_tiers,
    }: {
      id: string
      mode: CodFeeMode
      cod_fee: number | null
      cod_fee_tiers: CodFeeTier[]
    }) =>
      adminFetch<UpdateCodFeeResponse>(`/admin/cod-fees/${id}`, {
        method: "POST",
        body: JSON.stringify({ mode, cod_fee, cod_fee_tiers }),
      }),
    onSuccess: (result) => {
      setDrafts((current) => ({
        ...current,
        [result.shipping_option.id]: toDraft(result.shipping_option),
      }))
      queryClient.invalidateQueries({ queryKey: ["admin-cod-fees"] })
      toast.success(t("codFees.saved"))
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : t("codFees.saveError")
      )
    },
  })

  const savingId = saveMutation.isPending
    ? saveMutation.variables?.id
    : undefined

  const rows = useMemo(() => options, [options])

  const updateDraft = (id: string, patch: Partial<DraftConfig>) => {
    setDrafts((current) => {
      const existing = current[id]
      if (!existing) {
        return current
      }
      return {
        ...current,
        [id]: { ...existing, ...patch },
      }
    })
  }

  const buildPayload = (
    draft: DraftConfig
  ):
    | { mode: CodFeeMode; cod_fee: number | null; cod_fee_tiers: CodFeeTier[] }
    | { error: string } => {
    if (draft.mode === "flat") {
      const fee = parseNonNegative(draft.flat_fee, true)
      if (fee === undefined) {
        return { error: t("codFees.invalidFee") }
      }
      return { mode: "flat", cod_fee: fee, cod_fee_tiers: [] }
    }

    const tiers: CodFeeTier[] = []
    for (const row of draft.tiers) {
      const fee = parseNonNegative(row.fee, false)
      if (fee === undefined) {
        return { error: t("codFees.invalidTier") }
      }
      const max_amount = parseNonNegative(row.max_amount, true)
      if (max_amount === undefined) {
        return { error: t("codFees.invalidTier") }
      }
      // Skip completely empty rows (no fee entered meaningfully - fee required above)
      tiers.push({ max_amount, fee })
    }

    if (tiers.length === 0) {
      return { error: t("codFees.invalidTier") }
    }

    return { mode: "tiers", cod_fee: null, cod_fee_tiers: tiers }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div>
          <Heading level="h1">{t("codFees.title")}</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            {t("codFees.description")}
          </Text>
        </div>
        <Button
          variant="secondary"
          size="small"
          onClick={() => refetch()}
          isLoading={isFetching}
        >
          {t("codFees.refresh")}
        </Button>
      </div>

      {isLoading ? (
        <div className="px-6 py-8">
          <Text size="small" className="text-ui-fg-muted">
            {t("codFees.loading")}
          </Text>
        </div>
      ) : error ? (
        <div className="flex flex-col items-start gap-3 px-6 py-8">
          <Text size="small" className="text-ui-fg-error">
            {t("codFees.loadError")}
          </Text>
          <Button variant="secondary" size="small" onClick={() => refetch()}>
            {t("codFees.retry")}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-6 py-8">
          <Text size="small" className="text-ui-fg-muted">
            {t("codFees.empty")}
          </Text>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t("codFees.columns.name")}</Table.HeaderCell>
                <Table.HeaderCell>{t("codFees.columns.type")}</Table.HeaderCell>
                <Table.HeaderCell>{t("codFees.columns.mode")}</Table.HeaderCell>
                <Table.HeaderCell>{t("codFees.columns.fee")}</Table.HeaderCell>
                <Table.HeaderCell className="w-[1%] whitespace-nowrap">
                  {t("codFees.columns.actions")}
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((option) => {
                const saved = toDraft(option)
                const draft = drafts[option.id] ?? saved
                const isDirty = !draftsEqual(draft, saved)
                const isExpanded = expandedId === option.id

                const summary =
                  draft.mode === "flat"
                    ? draft.flat_fee.trim() || "—"
                    : t("codFees.tiersSummary", {
                        count: draft.tiers.length,
                      })

                return (
                  <Fragment key={option.id}>
                    <Table.Row>
                      <Table.Cell>
                        <div className="flex flex-col gap-0.5">
                          <Text size="small" leading="compact" weight="plus">
                            {option.name}
                          </Text>
                          <Text size="small" className="text-ui-fg-muted">
                            {option.id}
                          </Text>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="small">
                          {option.type_label || option.type_code || "—"}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="w-[140px]">
                          <Select
                            value={draft.mode}
                            onValueChange={(value) => {
                              const mode = value as CodFeeMode
                              updateDraft(option.id, { mode })
                              if (mode === "tiers") {
                                setExpandedId(option.id)
                              }
                            }}
                          >
                            <Select.Trigger>
                              <Select.Value />
                            </Select.Trigger>
                            <Select.Content>
                              <Select.Item value="flat">
                                {t("codFees.modeFlat")}
                              </Select.Item>
                              <Select.Item value="tiers">
                                {t("codFees.modeTiers")}
                              </Select.Item>
                            </Select.Content>
                          </Select>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        {draft.mode === "flat" ? (
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            className="max-w-[140px]"
                            value={draft.flat_fee}
                            placeholder="0"
                            onChange={(event) => {
                              updateDraft(option.id, {
                                flat_fee: event.target.value,
                              })
                            }}
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <Text size="small">{summary}</Text>
                            <Button
                              size="small"
                              variant="transparent"
                              onClick={() =>
                                setExpandedId(isExpanded ? null : option.id)
                              }
                            >
                              {isExpanded
                                ? t("codFees.hideTiers")
                                : t("codFees.editTiers")}
                            </Button>
                          </div>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          size="small"
                          variant="secondary"
                          disabled={!isDirty || savingId === option.id}
                          isLoading={savingId === option.id}
                          onClick={() => {
                            const payload = buildPayload(draft)
                            if ("error" in payload) {
                              toast.error(payload.error)
                              return
                            }
                            saveMutation.mutate({
                              id: option.id,
                              ...payload,
                            })
                          }}
                        >
                          {t("codFees.save")}
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                    {draft.mode === "tiers" && isExpanded ? (
                      <Table.Row>
                        <Table.Cell colSpan={5}>
                          <div className="flex flex-col gap-3 py-2">
                            <Text size="small" className="text-ui-fg-subtle">
                              {t("codFees.tiersHelp")}
                            </Text>
                            <div className="overflow-x-auto rounded-md border border-ui-border-base">
                              <Table>
                                <Table.Header>
                                  <Table.Row>
                                    <Table.HeaderCell>
                                      {t("codFees.tierMaxAmount")}
                                    </Table.HeaderCell>
                                    <Table.HeaderCell>
                                      {t("codFees.tierFee")}
                                    </Table.HeaderCell>
                                    <Table.HeaderCell className="w-[1%]" />
                                  </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                  {draft.tiers.map((tier, index) => (
                                    <Table.Row key={index}>
                                      <Table.Cell>
                                        <Input
                                          type="number"
                                          min={0}
                                          step="any"
                                          className="max-w-[160px]"
                                          value={tier.max_amount}
                                          placeholder={t(
                                            "codFees.tierMaxPlaceholder"
                                          )}
                                          onChange={(event) => {
                                            const tiers = draft.tiers.map(
                                              (row, i) =>
                                                i === index
                                                  ? {
                                                      ...row,
                                                      max_amount:
                                                        event.target.value,
                                                    }
                                                  : row
                                            )
                                            updateDraft(option.id, { tiers })
                                          }}
                                        />
                                      </Table.Cell>
                                      <Table.Cell>
                                        <Input
                                          type="number"
                                          min={0}
                                          step="any"
                                          className="max-w-[140px]"
                                          value={tier.fee}
                                          placeholder="0"
                                          onChange={(event) => {
                                            const tiers = draft.tiers.map(
                                              (row, i) =>
                                                i === index
                                                  ? {
                                                      ...row,
                                                      fee: event.target.value,
                                                    }
                                                  : row
                                            )
                                            updateDraft(option.id, { tiers })
                                          }}
                                        />
                                      </Table.Cell>
                                      <Table.Cell>
                                        <Button
                                          size="small"
                                          variant="transparent"
                                          disabled={draft.tiers.length <= 1}
                                          onClick={() => {
                                            updateDraft(option.id, {
                                              tiers: draft.tiers.filter(
                                                (_, i) => i !== index
                                              ),
                                            })
                                          }}
                                        >
                                          {t("codFees.removeTier")}
                                        </Button>
                                      </Table.Cell>
                                    </Table.Row>
                                  ))}
                                </Table.Body>
                              </Table>
                            </div>
                            <div>
                              <Button
                                size="small"
                                variant="secondary"
                                onClick={() => {
                                  updateDraft(option.id, {
                                    tiers: [
                                      ...draft.tiers,
                                      { max_amount: "", fee: "" },
                                    ],
                                  })
                                }}
                              >
                                {t("codFees.addTier")}
                              </Button>
                            </div>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ) : null}
                  </Fragment>
                )
              })}
            </Table.Body>
          </Table>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Utánvéti díjak",
})

export default CodFeesPage
