/**
 * Lightweight admin client for custom Admin API routes.
 * Uses the dashboard session cookie (credentials: include).
 */
export async function adminFetch<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | number | undefined> }
): Promise<T> {
  const url = new URL(path, window.location.origin)

  if (init?.query) {
    for (const [key, value] of Object.entries(init.query)) {
      if (value === undefined || value === "") {
        continue
      }
      url.searchParams.set(key, String(value))
    }
  }

  const { query: _query, ...rest } = init ?? {}
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(rest.headers as Record<string, string> | undefined),
  }

  if (
    rest.body &&
    typeof rest.body === "string" &&
    !headers["Content-Type"] &&
    !headers["content-type"]
  ) {
    headers["Content-Type"] = "application/json"
  }

  const response = await fetch(url.pathname + url.search, {
    credentials: "include",
    ...rest,
    headers,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(
      body || `Request failed: ${response.status} ${response.statusText}`
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
