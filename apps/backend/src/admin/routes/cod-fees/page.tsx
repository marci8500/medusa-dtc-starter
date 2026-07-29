import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Button,
  Container,
  Heading,
  Input,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { adminFetch } from "../../lib/client"

type CodFeeShippingOption = {
  id: string
  name: string
  type_code: string | null
  type_label: string | null
  provider_id: string | null
  cod_fee: number | null
}

type CodFeesResponse = {
  shipping_options: CodFeeShippingOption[]
}

type UpdateCodFeeResponse = {
  shipping_option: CodFeeShippingOption
}

function feeInputValue(fee: number | null): string {
  return fee == null ? "" : String(fee)
}

const CodFeesPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [draftFees, setDraftFees] = useState<Record<string, string>>({})

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-cod-fees"],
    queryFn: () => adminFetch<CodFeesResponse>("/admin/cod-fees"),
  })

  const options = data?.shipping_options ?? []

  useEffect(() => {
    if (!data?.shipping_options) {
      return
    }
    setDraftFees((current) => {
      const next: Record<string, string> = {}
      for (const option of data.shipping_options) {
        next[option.id] =
          current[option.id] !== undefined
            ? current[option.id]
            : feeInputValue(option.cod_fee)
      }
      return next
    })
  }, [data])

  const saveMutation = useMutation({
    mutationFn: ({ id, cod_fee }: { id: string; cod_fee: number | null }) =>
      adminFetch<UpdateCodFeeResponse>(`/admin/cod-fees/${id}`, {
        method: "POST",
        body: JSON.stringify({ cod_fee }),
      }),
    onSuccess: (result) => {
      setDraftFees((current) => ({
        ...current,
        [result.shipping_option.id]: feeInputValue(result.shipping_option.cod_fee),
      }))
      queryClient.invalidateQueries({ queryKey: ["admin-cod-fees"] })
      toast.success(t("codFees.saved"))
    },
    onError: () => {
      toast.error(t("codFees.saveError"))
    },
  })

  const savingId = saveMutation.isPending
    ? saveMutation.variables?.id
    : undefined

  const rows = useMemo(() => options, [options])

  const parseDraftFee = (raw: string): number | null | undefined => {
    const trimmed = raw.trim()
    if (trimmed === "") {
      return null
    }
    const value = Number(trimmed.replace(",", "."))
    if (!Number.isFinite(value) || value < 0) {
      return undefined
    }
    return value
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
                <Table.HeaderCell>{t("codFees.columns.fee")}</Table.HeaderCell>
                <Table.HeaderCell className="w-[1%] whitespace-nowrap">
                  {t("codFees.columns.actions")}
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((option) => {
                const draft = draftFees[option.id] ?? feeInputValue(option.cod_fee)
                const parsed = parseDraftFee(draft)
                const isDirty =
                  feeInputValue(option.cod_fee) !== draft.trim() &&
                  !(option.cod_fee == null && draft.trim() === "")
                const isInvalid = parsed === undefined

                return (
                  <Table.Row key={option.id}>
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
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        className="max-w-[140px]"
                        value={draft}
                        placeholder="0"
                        onChange={(event) => {
                          const value = event.target.value
                          setDraftFees((current) => ({
                            ...current,
                            [option.id]: value,
                          }))
                        }}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={!isDirty || isInvalid || savingId === option.id}
                        isLoading={savingId === option.id}
                        onClick={() => {
                          if (parsed === undefined) {
                            toast.error(t("codFees.invalidFee"))
                            return
                          }
                          saveMutation.mutate({
                            id: option.id,
                            cod_fee: parsed,
                          })
                        }}
                      >
                        {t("codFees.save")}
                      </Button>
                    </Table.Cell>
                  </Table.Row>
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
