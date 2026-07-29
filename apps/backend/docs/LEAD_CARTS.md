# Lead carts (Admin)

Read-only Admin view of incomplete checkout carts that captured a phone number
(“leads”). Works with any storefront that follows the contract below.

## Menu

After starting / rebuilding the Medusa Admin, open:

**Admin sidebar → “Lead kosarak”** (`/app/leads`)

Page copy is translated (HU / EN) via Admin language settings. The sidebar
label is currently Hungarian: **Lead kosarak**.

## Storefront contract (stable)

To appear in this list, a cart must:

1. **Not** be completed (`completed_at` is null and no linked order).
2. Have a phone via either:
   - `metadata.lead_phone` (**stable key — keep this name**), or
   - `shipping_address.phone` / `billing_address.phone` (non-empty, not a placeholder like `—`).

Optional display fields (shown when present; placeholders ignored):

| Field | Notes |
| --- | --- |
| `email` | Shown when set |
| Shipping first/last name | `"—"` treated as empty |
| Postal code | `"0000"` treated as empty for display |

Example cart update payload (any storefront):

```json
{
  "shipping_address": {
    "first_name": "—",
    "last_name": "—",
    "address_1": "—",
    "city": "—",
    "postal_code": "0000",
    "country_code": "hu",
    "phone": "+36301234567"
  },
  "billing_address": {
    "phone": "+36301234567"
  },
  "metadata": {
    "lead_phone": "+36301234567"
  }
}
```

Prefer setting **`metadata.lead_phone`** so leads are storefront-agnostic and
easy to filter later.

## Admin API

| Method | Path | Auth |
| --- | --- | --- |
| `GET` | `/admin/leads` | Admin session, JWT, or secret API key |
| `GET` | `/admin/leads/:id` | same |

Query params for list:

- `limit` / `offset` — pagination (default limit 20)
- `q` — search phone, email, name, or cart id

Response shape:

```json
{
  "leads": [ /* LeadCartDTO */ ],
  "count": 0,
  "limit": 20,
  "offset": 0
}
```

Read-only: these routes never update or delete carts.

## Deploy / rebuild

Admin UI extensions are compiled with the Medusa Admin build.

1. Ensure `DISABLE_MEDUSA_ADMIN` is **not** `"true"`.
2. Deploy/restart the backend after pulling these changes.
3. Locally: `pnpm --filter @dtc/backend dev` (or `medusa develop`) so Admin Vite picks up `src/admin/**`.
4. Production: `medusa build` / your usual backend image build includes the Admin bundle — no extra env vars required for this feature.

## Verify

1. Storefront: new cart → enter phone (~6+ chars) → blur / wait ~1s.
2. Admin → **Lead kosarak** → row appears (newest first).
3. Fill name/email and save again → row updates.
4. Complete checkout → cart leaves the list (`completed_at` / order link).

## Out of scope (v1)

Abandoned-cart email, SMS, auto-discounts — display only.
