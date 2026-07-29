import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Table,
  Text,
  clx,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { adminFetch } from "../../lib/client"

type LeadCart = {
  id: string
  phone: string | null
  email: string | null
  customer_name: string | null
  item_count: number
  items_summary: string | null
  total: number | null
  currency_code: string | null
  updated_at: string | null
  created_at: string | null
  shipping_address: Record<string, string | null> | null
  billing_address: Record<string, string | null> | null
  items: Array<{
    id?: string
    title?: string | null
    quantity?: number | null
    unit_price?: number | string | null
    variant_sku?: string | null
  }>
  metadata: Record<string, unknown> | null
}

type LeadsResponse = {
  leads: LeadCart[]
  count: number
  limit: number
  offset: number
}

const PAGE_SIZE = 20

function formatMoney(
  amount: number | null,
  currencyCode: string | null
): string {
  if (amount == null) {
    return "—"
  }
  if (!currencyCode) {
    return String(amount)
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode.toUpperCase(),
    }).format(amount)
  } catch {
    return `${amount} ${currencyCode}`
  }
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—"
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function AddressBlock({
  title,
  address,
}: {
  title: string
  address: Record<string, string | null> | null
}) {
  if (!address) {
    return (
      <div>
        <Text size="small" leading="compact" weight="plus">
          {title}
        </Text>
        <Text size="small" className="text-ui-fg-muted">
          —
        </Text>
      </div>
    )
  }

  const lines = [
    [address.first_name, address.last_name].filter(Boolean).join(" "),
    address.company,
    address.address_1,
    address.address_2,
    [address.postal_code, address.city].filter(Boolean).join(" "),
    address.country_code?.toUpperCase(),
    address.phone,
  ].filter(Boolean)

  return (
    <div>
      <Text size="small" leading="compact" weight="plus">
        {title}
      </Text>
      {lines.length === 0 ? (
        <Text size="small" className="text-ui-fg-muted">
          —
        </Text>
      ) : (
        lines.map((line) => (
          <Text key={String(line)} size="small" className="text-ui-fg-subtle">
            {line}
          </Text>
        ))
      )}
    </div>
  )
}

const LeadsPage = () => {
  const { t } = useTranslation()
  const [pageIndex, setPageIndex] = useState(0)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<LeadCart | null>(null)

  const offset = pageIndex * PAGE_SIZE

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-leads", PAGE_SIZE, offset, search],
    queryFn: () =>
      adminFetch<LeadsResponse>("/admin/leads", {
        query: {
          limit: PAGE_SIZE,
          offset,
          q: search || undefined,
        },
      }),
  })

  const leads = data?.leads ?? []
  const count = data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE))

  const empty = !isLoading && leads.length === 0

  const rangeLabel = useMemo(() => {
    if (count === 0) {
      return t("leads.paginationEmpty")
    }
    const from = offset + 1
    const to = Math.min(offset + PAGE_SIZE, count)
    return t("leads.paginationRange", { from, to, count })
  }, [count, offset, t])

  const applySearch = () => {
    setPageIndex(0)
    setSearch(searchInput.trim())
  }

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Heading level="h1">{t("leads.title")}</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              {t("leads.description")}
            </Text>
          </div>
          <form
            className="flex w-full max-w-md items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              applySearch()
            }}
          >
            <Input
              type="search"
              placeholder={t("leads.searchPlaceholder")}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Button type="submit" variant="secondary" size="small">
              {t("leads.search")}
            </Button>
          </form>
        </div>

        {error ? (
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            <Text className="text-ui-fg-error">
              {t("leads.loadError")}
            </Text>
            <Button size="small" variant="secondary" onClick={() => refetch()}>
              {t("leads.retry")}
            </Button>
          </div>
        ) : null}

        <div className={clx("overflow-x-auto", isFetching && "opacity-70")}>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t("leads.columns.phone")}</Table.HeaderCell>
                <Table.HeaderCell>{t("leads.columns.email")}</Table.HeaderCell>
                <Table.HeaderCell>{t("leads.columns.name")}</Table.HeaderCell>
                <Table.HeaderCell>{t("leads.columns.items")}</Table.HeaderCell>
                <Table.HeaderCell>{t("leads.columns.total")}</Table.HeaderCell>
                <Table.HeaderCell>
                  {t("leads.columns.updatedAt")}
                </Table.HeaderCell>
                <Table.HeaderCell>{t("leads.columns.cartId")}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {isLoading ? (
                <Table.Row>
                  <Table.Cell className="py-8 text-center">
                    <Text className="text-ui-fg-muted">{t("leads.loading")}</Text>
                  </Table.Cell>
                </Table.Row>
              ) : empty ? (
                <Table.Row>
                  <Table.Cell className="py-8 text-center">
                    <Text className="text-ui-fg-muted">{t("leads.empty")}</Text>
                  </Table.Cell>
                </Table.Row>
              ) : (
                leads.map((lead) => (
                  <Table.Row
                    key={lead.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(lead)}
                  >
                    <Table.Cell>
                      <Text size="small" weight="plus">
                        {lead.phone ?? "—"}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small">{lead.email ?? "—"}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small">{lead.customer_name ?? "—"}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col gap-y-1">
                        <Badge size="2xsmall">{lead.item_count}</Badge>
                        <Text size="small" className="text-ui-fg-subtle">
                          {lead.items_summary ?? "—"}
                        </Text>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small">
                        {formatMoney(lead.total, lead.currency_code)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small">{formatDate(lead.updated_at)}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small" className="font-mono">
                        {lead.id}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        </div>

        <div className="flex items-center justify-between px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            {rangeLabel}
          </Text>
          <div className="flex items-center gap-2">
            <Button
              size="small"
              variant="secondary"
              disabled={pageIndex === 0 || isLoading}
              onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
            >
              {t("leads.prev")}
            </Button>
            <Text size="small">
              {t("leads.pageOf", {
                page: pageIndex + 1,
                pages: pageCount,
              })}
            </Text>
            <Button
              size="small"
              variant="secondary"
              disabled={offset + PAGE_SIZE >= count || isLoading}
              onClick={() => setPageIndex((value) => value + 1)}
            >
              {t("leads.next")}
            </Button>
          </div>
        </div>
      </Container>

      <Drawer
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null)
          }
        }}
      >
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{t("leads.detailsTitle")}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="overflow-y-auto">
            {selected ? (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-1">
                  <Text size="small" className="text-ui-fg-muted">
                    {t("leads.columns.cartId")}
                  </Text>
                  <Text size="small" className="font-mono">
                    {selected.id}
                  </Text>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Text size="small" className="text-ui-fg-muted">
                      {t("leads.columns.phone")}
                    </Text>
                    <Text size="small">{selected.phone ?? "—"}</Text>
                  </div>
                  <div>
                    <Text size="small" className="text-ui-fg-muted">
                      {t("leads.columns.email")}
                    </Text>
                    <Text size="small">{selected.email ?? "—"}</Text>
                  </div>
                  <div>
                    <Text size="small" className="text-ui-fg-muted">
                      {t("leads.columns.name")}
                    </Text>
                    <Text size="small">{selected.customer_name ?? "—"}</Text>
                  </div>
                  <div>
                    <Text size="small" className="text-ui-fg-muted">
                      {t("leads.columns.total")}
                    </Text>
                    <Text size="small">
                      {formatMoney(selected.total, selected.currency_code)}
                    </Text>
                  </div>
                  <div>
                    <Text size="small" className="text-ui-fg-muted">
                      {t("leads.columns.updatedAt")}
                    </Text>
                    <Text size="small">{formatDate(selected.updated_at)}</Text>
                  </div>
                </div>

                <div>
                  <Text size="small" leading="compact" weight="plus">
                    {t("leads.itemsHeading")}
                  </Text>
                  {selected.items.length === 0 ? (
                    <Text size="small" className="text-ui-fg-muted">
                      —
                    </Text>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-2">
                      {selected.items.map((item, index) => (
                        <li
                          key={item.id ?? `${item.title}-${index}`}
                          className="flex items-start justify-between gap-4"
                        >
                          <div>
                            <Text size="small">
                              {item.quantity ?? 0}× {item.title ?? "—"}
                            </Text>
                            {item.variant_sku ? (
                              <Text
                                size="small"
                                className="text-ui-fg-muted font-mono"
                              >
                                {item.variant_sku}
                              </Text>
                            ) : null}
                          </div>
                          <Text size="small">
                            {formatMoney(
                              item.unit_price == null
                                ? null
                                : Number(item.unit_price),
                              selected.currency_code
                            )}
                          </Text>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <AddressBlock
                    title={t("leads.shippingAddress")}
                    address={selected.shipping_address}
                  />
                  <AddressBlock
                    title={t("leads.billingAddress")}
                    address={selected.billing_address}
                  />
                </div>
              </div>
            ) : null}
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              {t("leads.close")}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </>
  )
}

export const config = defineRouteConfig({
  label: "Lead kosarak",
})

export default LeadsPage
