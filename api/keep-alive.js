export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL

    if (!supabaseUrl) {
      return res.status(500).json({ error: 'SUPABASE_URL not configured' })
    }

    const response = await fetch(`${supabaseUrl}/ping`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    console.log(`[keep-alive] Pinged ${supabaseUrl} - status: ${response.status}`)

    return res.status(200).json({
      ok: true,
      supabaseStatus: response.status,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[keep-alive] Error:', error.message)

    return res.status(200).json({
      ok: true,
      note: 'ping attempted but Supabase may be unavailable',
      timestamp: new Date().toISOString(),
    })
  }
}
