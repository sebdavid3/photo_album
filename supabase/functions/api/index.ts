import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface RequestBody {
  password: string
  action: string
  [key: string]: any
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body: RequestBody = await req.json()
    const { password, action } = body

    if (!password || !action) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos requeridos (password, action)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar contraseña para todas las acciones
    const { data: isValid, error: verifyError } = await supabase
      .rpc('verify_password', { password_attempt: password })

    if (verifyError || !isValid) {
      return new Response(
        JSON.stringify({ error: 'Contraseña incorrecta' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let result

    switch (action) {

      // ============================================================
      // Auth
      // ============================================================
      case 'login': {
        const { data: settingsData } = await supabase
          .from('settings')
          .select('album_name')
          .single()
        result = {
          success: true,
          message: 'Autenticado correctamente',
          album_name: settingsData?.album_name || 'Nuestro Album'
        }
        break
      }

      // ============================================================
      // Settings
      // ============================================================
      case 'get_settings': {
        const { data, error } = await supabase
          .from('settings')
          .select('album_name, created_at')
          .single()
        if (error) throw error
        result = { settings: data }
        break
      }

      case 'update_settings': {
        const updateData: any = { updated_at: new Date().toISOString() }
        if (body.album_name !== undefined) updateData.album_name = body.album_name

        const { error } = await supabase
          .from('settings')
          .update(updateData)
          .eq('id', 1)
        if (error) throw error

        // Cambiar contraseña si se envió
        if (body.new_password) {
          const { error: passError } = await supabase
            .rpc('set_password', { new_password: body.new_password })
          if (passError) throw passError
        }

        const { data, error: fetchError } = await supabase
          .from('settings')
          .select('album_name, created_at')
          .single()
        if (fetchError) throw fetchError
        result = { settings: data }
        break
      }

      // ============================================================
      // Photos
      // ============================================================
      case 'get_photos': {
        const { data, error } = await supabase
          .from('photos')
          .select('*')
          .order('created_at', { ascending: false })
        if (error) throw error
        result = { photos: data }
        break
      }

      case 'create_photo': {
        if (!body.title || !body.image_url) {
          return new Response(
            JSON.stringify({ error: 'Faltan campos: title, image_url' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { data, error } = await supabase
          .from('photos')
          .insert({
            title: body.title,
            description: body.description || '',
            image_url: body.image_url,
          })
          .select()
          .single()
        if (error) throw error
        result = { photo: data }
        break
      }

      case 'update_photo': {
        if (!body.id) {
          return new Response(
            JSON.stringify({ error: 'Falta campo: id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const updateData: any = { updated_at: new Date().toISOString() }
        if (body.title !== undefined) updateData.title = body.title
        if (body.description !== undefined) updateData.description = body.description

        const { data, error } = await supabase
          .from('photos')
          .update(updateData)
          .eq('id', body.id)
          .select()
          .single()
        if (error) throw error
        result = { photo: data }
        break
      }

      case 'toggle_favorite': {
        if (!body.id) {
          return new Response(
            JSON.stringify({ error: 'Falta campo: id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { data: photo, error: fetchError } = await supabase
          .from('photos')
          .select('favorite')
          .eq('id', body.id)
          .single()
        if (fetchError) throw fetchError

        const newFav = !photo.favorite

        const { data, error } = await supabase
          .from('photos')
          .update({ favorite: newFav, updated_at: new Date().toISOString() })
          .eq('id', body.id)
          .select()
          .single()
        if (error) throw error

        // Auto-manage "Favoritos" album
        const { data: favAlbum } = await supabase
          .from('albums')
          .select('id')
          .eq('title', 'Favoritos')
          .maybeSingle()

        let favAlbumId = favAlbum?.id

        if (!favAlbumId) {
          const { data: newAlbum, error: createError } = await supabase
            .from('albums')
            .insert({ title: 'Favoritos', description: 'Tus fotos favoritas' })
            .select('id')
            .single()
          if (!createError) favAlbumId = newAlbum.id
        }

        if (favAlbumId) {
          if (newFav) {
            await supabase
              .from('album_photos')
              .upsert({ album_id: favAlbumId, photo_id: body.id }, { onConflict: 'album_id,photo_id' })
          } else {
            await supabase
              .from('album_photos')
              .delete()
              .eq('album_id', favAlbumId)
              .eq('photo_id', body.id)
          }
        }

        result = { photo: data }
        break
      }

      case 'delete_photo': {
        if (!body.id) {
          return new Response(
            JSON.stringify({ error: 'Falta campo: id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { error } = await supabase
          .from('photos')
          .delete()
          .eq('id', body.id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ============================================================
      // Letters (Cartas)
      // ============================================================
      case 'get_letters': {
        const { data, error } = await supabase
          .from('letters')
          .select('*')
          .order('created_at', { ascending: false })
        if (error) throw error
        result = { letters: data }
        break
      }

      case 'create_letter': {
        if (!body.title) {
          return new Response(
            JSON.stringify({ error: 'Falta campo: title' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { data, error } = await supabase
          .from('letters')
          .insert({
            title: body.title,
            content: body.content || '',
            pdf_url: body.pdf_url || null,
            pdf_name: body.pdf_name || null,
            video_url: body.video_url || null,
          })
          .select()
          .single()
        if (error) throw error
        result = { letter: data }
        break
      }

      case 'update_letter': {
        if (!body.id) {
          return new Response(
            JSON.stringify({ error: 'Falta campo: id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const updateData: any = { updated_at: new Date().toISOString() }
        if (body.title !== undefined) updateData.title = body.title
        if (body.content !== undefined) updateData.content = body.content
        if (body.pdf_url !== undefined) updateData.pdf_url = body.pdf_url
        if (body.pdf_name !== undefined) updateData.pdf_name = body.pdf_name
        if (body.video_url !== undefined) updateData.video_url = body.video_url

        const { data, error } = await supabase
          .from('letters')
          .update(updateData)
          .eq('id', body.id)
          .select()
          .single()
        if (error) throw error
        result = { letter: data }
        break
      }

      case 'delete_letter': {
        if (!body.id) {
          return new Response(
            JSON.stringify({ error: 'Falta campo: id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { error } = await supabase
          .from('letters')
          .delete()
          .eq('id', body.id)
        if (error) throw error
        result = { success: true }
        break
      }

      // ============================================================
      // Albums
      // ============================================================
      case 'create_album': {
        if (!body.title) {
          return new Response(
            JSON.stringify({ error: 'Falta campo: title' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { data, error } = await supabase
          .from('albums')
          .insert({
            title: body.title,
            description: body.description || '',
          })
          .select()
          .single()
        if (error) throw error
        result = { album: data }
        break
      }

      case 'update_album': {
        if (!body.id) {
          return new Response(
            JSON.stringify({ error: 'Falta campo: id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const updateData: any = { updated_at: new Date().toISOString() }
        if (body.title !== undefined) updateData.title = body.title
        if (body.description !== undefined) updateData.description = body.description

        const { data, error } = await supabase
          .from('albums')
          .update(updateData)
          .eq('id', body.id)
          .select()
          .single()
        if (error) throw error
        result = { album: data }
        break
      }

      case 'delete_album': {
        if (!body.id) {
          return new Response(
            JSON.stringify({ error: 'Falta campo: id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { error } = await supabase
          .from('albums')
          .delete()
          .eq('id', body.id)
        if (error) throw error
        result = { success: true }
        break
      }

      case 'add_photos_to_album': {
        if (!body.album_id || !body.photo_ids || !Array.isArray(body.photo_ids)) {
          return new Response(
            JSON.stringify({ error: 'Faltan campos: album_id, photo_ids (array)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const rows = body.photo_ids.map((photo_id: string) => ({
          album_id: body.album_id,
          photo_id,
        }))
        const { error } = await supabase
          .from('album_photos')
          .upsert(rows, { onConflict: 'album_id,photo_id' })
        if (error) throw error
        result = { success: true }
        break
      }

      case 'remove_photo_from_album': {
        if (!body.album_id || !body.photo_id) {
          return new Response(
            JSON.stringify({ error: 'Faltan campos: album_id, photo_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { error } = await supabase
          .from('album_photos')
          .delete()
          .eq('album_id', body.album_id)
          .eq('photo_id', body.photo_id)
        if (error) throw error
        result = { success: true }
        break
      }

      default: {
        return new Response(
          JSON.stringify({ error: `Acción desconocida: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('API Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
