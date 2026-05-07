/**
 * Vercel Edge Middleware — blocks internal API documentation in all deployed environments.
 *
 * Internal pages (flow.html, books.html) and their OpenAPI specs are for local
 * development only. Any deployed request to these paths returns 404 immediately —
 * no login, no redirect, no workaround.
 *
 * In local dev (Vite dev server / vite preview), this middleware does not run,
 * so internal pages are naturally accessible on localhost.
 */

const INTERNAL_PATHS = new Set([
  '/flow.html',
  '/books.html',
  '/openapi-flow.json',
  '/openapi-books.json',
])

export default function middleware(request) {
  const { pathname } = new URL(request.url)

  if (!INTERNAL_PATHS.has(pathname)) return

  return new Response('Not Found', { status: 404 })
}

export const config = {
  matcher: [
    '/flow.html',
    '/books.html',
    '/openapi-flow.json',
    '/openapi-books.json',
  ],
}
