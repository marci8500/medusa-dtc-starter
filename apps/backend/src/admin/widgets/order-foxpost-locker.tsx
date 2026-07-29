import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Container, Heading, Text } from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import { extractFoxpostLocker } from "../lib/foxpost-locker"

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-1">
      <Text size="small" className="text-ui-fg-muted">
        {label}
      </Text>
      <Text size="small" leading="compact">
        {value}
      </Text>
    </div>
  )
}

const OrderFoxpostLockerWidget = ({
  data,
}: DetailWidgetProps<HttpTypes.AdminOrder>) => {
  const { t } = useTranslation()
  const locker = extractFoxpostLocker(
    (data.metadata as Record<string, unknown> | null | undefined) ?? null
  )

  if (!locker) {
    return <></>
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">{t("foxpost.title")}</Heading>
      </div>
      <div className="flex flex-col gap-4 px-6 py-4">
        <Field label={t("foxpost.lockerName")} value={locker.locker_name} />
        <Field
          label={t("foxpost.lockerAddress")}
          value={locker.locker_address}
        />
        <Field label={t("foxpost.lockerId")} value={locker.locker_id} />
        <Field label={t("foxpost.placeId")} value={locker.place_id} />
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
  id: "cellashop:order-foxpost-locker",
})

export default OrderFoxpostLockerWidget
