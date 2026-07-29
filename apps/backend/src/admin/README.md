# Admin Customizations

You can extend the Medusa Admin to add widgets and new pages. Your customizations interact with API routes to provide merchants with custom functionalities.

> Learn more about Admin Extensions in [this documentation](https://docs.medusajs.com/learn/fundamentals/admin).

## Lead kosarak (Lead carts)

Sidebar page at `/app/leads` listing incomplete carts with a captured phone (`metadata.lead_phone` or address phone). Supports status updates and convert-to-draft-order. See [docs/LEAD_CARTS.md](../docs/LEAD_CARTS.md) for the storefront contract, Admin API, and deploy notes.

## COD fees (Utánvéti díjak)

Sidebar page at `/app/cod-fees` to configure COD fees per shipping option (courier):

- **Flat** — single `metadata.cod_fee`
- **Tiers** — `metadata.cod_fee_mode = "tiers"` and `metadata.cod_fee_tiers` brackets on the COD base amount (items + shipping, excluding the COD fee line)

When the customer selects Cash on Delivery (`pp_system_default`) and a shipping option with a fee, the backend adds a “Cash on Delivery fee” line item to the cart.

## Foxpost locker (order widget)

On order details (sidebar), a **Foxpost locker / Foxpost automata** widget shows `foxpost_locker_*` metadata when present. Hidden for non-Foxpost orders. An `order.placed` subscriber also copies those keys from the cart if they were missing on the order.

## Example: Create a Widget

A widget is a React component that can be injected into an existing page in the admin dashboard.

For example, create the file `src/admin/widgets/product-widget.tsx` with the following content:

```tsx title="src/admin/widgets/product-widget.tsx"
import { defineWidgetConfig } from "@medusajs/admin-sdk"

// The widget
const ProductWidget = () => {
  return (
    <div>
      <h2>Product Widget</h2>
    </div>
  )
}

// The widget's configurations
export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductWidget
```

This inserts a widget with the text “Product Widget” at the end of a product’s details page.