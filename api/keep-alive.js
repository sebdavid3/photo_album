export default async function handler(req, res) {
  const start = Date.now()

  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl) {
      console.error('[keep-alive] Missing SUPABASE_URL env var')
      return res.status(500).json({ error: 'SUPABASE_URL not configured' })
    }
    if (!supabaseKey) {
      console.error('[keep-alive] Missing SUPABASE_ANON_KEY env var')
      return res.status(500).json({ error: 'SUPABASE_ANON_KEY not configured' })
    }

    // Real query via Supabase REST API (PostgREST) to wake the database
    const response = await fetch(`${supabaseUrl}/rest/v1/settings?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    })

    const elapsed = Date.now() - start
    const body = await response.text()

    console.log(`[keep-alive] OK — status=${response.status} db=${body} ms=${elapsed}`)

    return res.status(200).json({
      ok: true,
      supabaseStatus: response.status,
      dbResponse: response.ok ? body : null,
      elapsedMs: elapsed,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const elapsed = Date.now() - start

    console.error(`[keep-alive] ERROR — ${error.message} ms=${elapsed}`)

    return res.status(500).json({
      ok: false,
      error: error.message,
      elapsedMs: elapsed,
      timestamp: new Date().toISOString(),
    })
  }
}
