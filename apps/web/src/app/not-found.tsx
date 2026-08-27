/**
 * Global 404 — for requests that never matched a locale segment.
 *
 * Cannot use `useTranslations`: there is no locale in scope, so there is no
 * message catalogue to read. It is intentionally minimal and links into the
 * default locale, where the translated page lives.
 */
export default function GlobalNotFound() {
  return (
    <html lang="uz">
      <body
        style={{
          background: '#08090B',
          color: '#F5F7F6',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <main style={{ textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>404</h1>
          <p style={{ marginTop: '1rem' }}>
            <a href="/uz" style={{ color: '#2EB66A' }}>
              BARFF
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
