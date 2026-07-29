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

  const response = await fetch(url.pathname + url.search, {
    credentials: "include",
    ...rest,
    headers: {
      Accept: "application/json",
      ...(rest.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(
      body || `Request failed: ${response.status} ${response.statusText}`
    )
  }

  return (await response.json()) as T
}
