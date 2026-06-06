// ============================================================
// CONFIG - desde config.js (generado por scripts/generate-config.sh)
// ============================================================
const APP_CONFIG = window.APP_CONFIG || {}
const SUPABASE_URL = APP_CONFIG.SUPABASE_URL || ''
const SUPABASE_ANON_KEY = APP_CONFIG.SUPABASE_ANON_KEY || ''
const API_URL = SUPABASE_URL + '/functions/v1/api'

// ============================================================
// STATE
// ============================================================
let currentPhotoId = null
let editingLetterId = null
let currentAlbumId = null
let pendingAction = null // callback to retry after login
let selectedPhotos = new Set()

// ============================================================
// SUPABASE CLIENT
// ============================================================
const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ============================================================
// AUTH HELPERS
// ============================================================
function getPassword() { return sessionStorage.getItem('album_password') || '' }
function setPassword(pw) { sessionStorage.setItem('album_password', pw) }
function clearPassword() { sessionStorage.removeItem('album_password') }
function isLoggedIn() { return !!getPassword() }

// ============================================================
// API (protected actions only)
// ============================================================
async function api(action, data = {}) {
  const password = getPassword()
  if (!password) throw new Error('NO_AUTH')
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, action, ...data })
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || 'Error')
  return result
}

// ============================================================
// PUBLIC READS (Supabase directo)
// ============================================================
async function fetchPublic(table, query = q => q) {
  let q = sbClient.from(table).select('*')
  q = query(q)
  const { data, error } = await q
  if (error) throw error
  return data
}

// ============================================================
// REQUIRE AUTH GUARD
// ============================================================
function requireAuth(actionFn) {
  return async function(...args) {
    if (isLoggedIn()) {
      return actionFn(...args)
    }
    pendingAction = () => actionFn(...args)
    showLoginModal()
  }
}

// ============================================================
// HELPERS
// ============================================================
function formatDate(d) {
  return new Date(d).toLocaleDateString('es-ES', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg
  document.body.appendChild(t); setTimeout(() => t.remove(), 3000)
}

// ============================================================
// LOGIN MODAL
// ============================================================
function showLoginModal() {
  document.getElementById('login-modal').classList.remove('hidden')
  document.getElementById('login-modal-password').value = ''
  document.getElementById('login-modal-error').textContent = ''
  document.getElementById('login-modal-password').focus()
}

function hideLoginModal() {
  document.getElementById('login-modal').classList.add('hidden')
}

async function handleLoginModal() {
  const pw = document.getElementById('login-modal-password').value
  const err = document.getElementById('login-modal-error')
  if (!pw) { err.textContent = 'Ingresa la contrasena'; return }
  try {
    const res = await fetch(API_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw, action: 'login' })
    })
    const data = await res.json()
    if (!res.ok || !data.success) { err.textContent = 'Contrasena incorrecta'; return }
    setPassword(pw)
    if (data.album_name) { document.title = data.album_name }
    hideLoginModal()
    toast('Sesion iniciada')
    if (pendingAction) { const fn = pendingAction; pendingAction = null; fn() }
  } catch (e) { err.textContent = 'Error de conexion' }
}

document.getElementById('login-modal-btn').addEventListener('click', handleLoginModal)
document.getElementById('login-modal-close').addEventListener('click', hideLoginModal)
document.getElementById('login-modal-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleLoginModal() })
document.getElementById('login-modal').addEventListener('click', e => { if (e.target === e.currentTarget) hideLoginModal() })

// ============================================================
// TAB SWITCHING
// ============================================================
function openTab(evt, tabName) {
  const contents = document.getElementsByClassName('content')
  for (let i = 0; i < contents.length; i++) contents[i].style.display = 'none'
  document.getElementById(tabName).style.display = 'block'

  const tabs = document.getElementsByClassName('menu__tab')
  for (let i = 0; i < tabs.length; i++) tabs[i].className = tabs[i].className.replace(' menu__tab--active', '')
  evt.currentTarget.className += ' menu__tab--active'

  if (tabName === 'galeria') loadGallery()
  if (tabName === 'albumes') loadAlbums()
  if (tabName === 'cartas') loadLetters()

}

// ============================================================
// GALLERY
// ============================================================
async function loadGallery() {
  const c = document.getElementById('gallery-container')
  c.innerHTML = '<div class="loading">Cargando recuerdos...</div>'
  try {
    const photos = await fetchPublic('photos', q => q.order('created_at', { ascending: false }))
    if (!photos.length) { c.innerHTML = '<p class="no-data">Aun no hay fotos. Sube la primera!</p>'; return }
    c.innerHTML = '<div class="gallery-grid"></div>'
    const grid = c.querySelector('.gallery-grid')
    photos.forEach(p => {
      const card = document.createElement('div')
      card.className = 'photo-card'
      card.style.position = 'relative'
      card.innerHTML = `<img src="${p.image_url}" alt="${p.title}" loading="lazy" /><div class="photo-info"><div class="photo-title">${p.title}</div><div class="photo-date">${formatDate(p.created_at)}</div></div>`
      card.addEventListener('click', () => openPhotoModal(p))
      grid.appendChild(card)
    })
  } catch (e) { c.innerHTML = `<p class="error-msg">Error: ${e.message}</p>` }
}

// ============================================================
// CAT MUSIC (background player)
// ============================================================
const musicFiles = [
  { file: 'Stardew Valley OST - Stardew Valley Overture.mp3', name: 'Stardew Valley Overture', artist: 'ConcernedApe' },
  { file: 'Stardew Valley OST - Pelican Town.mp3', name: 'Pelican Town', artist: 'ConcernedApe' },
  { file: 'Stardew Valley OST - Grandpa\'s Theme.mp3', name: "Grandpa's Theme", artist: 'ConcernedApe' },
  { file: 'Stardew Valley OST - Cloud Country.mp3', name: 'Cloud Country', artist: 'ConcernedApe' },
]

let bgAudio = null
let currentTrackIdx = -1

function toggleBgMusic() {
  if (!musicFiles.length) {
    toast('No hay canciones en assets/audios/')
    return
  }

  if (bgAudio && !bgAudio.paused) {
    bgAudio.pause()
    document.getElementById('music-indicator').classList.remove('playing')
    return
  }

  if (bgAudio) {
    bgAudio.play()
    document.getElementById('music-indicator').classList.add('playing')
    return
  }

  currentTrackIdx = 0
  playTrackBg(0)
}

function playTrackBg(idx) {
  if (idx < 0 || idx >= musicFiles.length) return
  currentTrackIdx = idx
  const track = musicFiles[idx]

  if (bgAudio) {
    bgAudio.pause()
    bgAudio = null
  }

  bgAudio = new Audio(`assets/audio/${track.file}`)
  bgAudio.loop = true
  bgAudio.volume = 0.3

  bgAudio.addEventListener('ended', () => {
    // loop is true so this shouldn't fire, but just in case
  })

  bgAudio.addEventListener('error', () => {
    toast('Error al reproducir: ' + track.file)
    document.getElementById('music-indicator').classList.remove('playing')
  })

  bgAudio.play().then(() => {
    document.getElementById('music-indicator').classList.add('playing')
  }).catch(() => {
    toast('Haz clic en el gato para reproducir musica')
  })
}

document.getElementById('avatar-mascot').addEventListener('click', toggleBgMusic)

// ============================================================
// UPLOAD MODAL
// ============================================================
let uploadTargetAlbum = null

document.getElementById('gallery-upload-btn').addEventListener('click', () => {
  uploadTargetAlbum = null
  openUploadModal()
})

function openUploadModal(albumId = null) {
  if (!isLoggedIn()) { pendingAction = () => openUploadModal(albumId); showLoginModal(); return }
  uploadTargetAlbum = albumId
  document.getElementById('upload-modal').classList.remove('hidden')
  document.getElementById('upload-photo-file').value = ''
  document.getElementById('upload-photo-name').textContent = ''
  document.getElementById('upload-photo-title').value = ''
  document.getElementById('upload-photo-desc').value = ''
  document.getElementById('upload-preview-wrap').classList.add('hidden')
  document.getElementById('upload-modal-error').textContent = ''
  document.getElementById('upload-progress-bar-wrap').style.display = 'none'
  document.getElementById('upload-progress-bar').style.width = '0%'
  document.getElementById('upload-modal-target').textContent = albumId ? 'Se agregara al album actual' : ''
  if (albumId) document.getElementById('upload-modal-target').style.display = 'block'
}

document.getElementById('upload-modal-close').addEventListener('click', () => {
  document.getElementById('upload-modal').classList.add('hidden')
})

document.getElementById('upload-photo-file').addEventListener('change', function() {
  const f = this.files[0]
  document.getElementById('upload-photo-name').textContent = f ? f.name : ''
  if (f) {
    document.getElementById('upload-preview-wrap').classList.remove('hidden')
    document.getElementById('upload-preview-img').src = URL.createObjectURL(f)
  }
})

document.getElementById('upload-modal-submit').addEventListener('click', async () => {
  const fileInput = document.getElementById('upload-photo-file')
  const title = document.getElementById('upload-photo-title').value.trim()
  const desc = document.getElementById('upload-photo-desc').value.trim()
  const err = document.getElementById('upload-modal-error')
  const bar = document.getElementById('upload-progress-bar-wrap')
  const barFill = document.getElementById('upload-progress-bar')

  err.textContent = ''
  if (!fileInput.files[0]) { err.textContent = 'Selecciona una imagen'; return }
  if (!title) { err.textContent = 'Escribe un titulo'; return }

  bar.style.display = 'block'; barFill.style.width = '30%'
  try {
    const file = fileInput.files[0]
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: upErr } = await sbClient.storage.from('photos').upload(fileName, file, { cacheControl: '3600', upsert: false })
    if (upErr) throw upErr
    barFill.style.width = '70%'
    const { data: urlData } = sbClient.storage.from('photos').getPublicUrl(fileName)
    barFill.style.width = '90%'

    const result = await api('create_photo', { title, description: desc, image_url: urlData.publicUrl })
    barFill.style.width = '100%'

    // If uploading within an album, add to album
    if (uploadTargetAlbum) {
      await api('add_photos_to_album', { album_id: uploadTargetAlbum, photo_ids: [result.photo.id] })
    }

    toast('Foto subida!')
    document.getElementById('upload-modal').classList.add('hidden')
    loadGallery()
    if (uploadTargetAlbum) loadAlbumPhotos(uploadTargetAlbum)
    setTimeout(() => { bar.style.display = 'none'; barFill.style.width = '0%' }, 500)
  } catch (e) { err.textContent = e.message; bar.style.display = 'none'; barFill.style.width = '0%' }
})

// ============================================================
// PHOTO MODAL
// ============================================================
function openPhotoModal(photo) {
  currentPhotoId = photo.id
  document.getElementById('modal-img').src = photo.image_url
  document.getElementById('modal-title').textContent = photo.title
  document.getElementById('modal-desc').textContent = photo.description || ''
  document.getElementById('modal-date').textContent = formatDate(photo.created_at)
  document.getElementById('modal-delete-btn').onclick = requireAuth(() => deletePhoto(photo.id))
  document.getElementById('photo-modal').classList.remove('hidden')
}

function closePhotoModal() { document.getElementById('photo-modal').classList.add('hidden'); currentPhotoId = null }
document.getElementById('modal-close').addEventListener('click', closePhotoModal)
document.getElementById('photo-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closePhotoModal() })
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePhotoModal() })

async function deletePhoto(id) {
  if (!confirm('Borrar este recuerdo?')) return
  await api('delete_photo', { id })
  toast('Borrado'); closePhotoModal(); loadGallery()
}

// ============================================================
// ALBUMS
// ============================================================
async function loadAlbums() {
  document.getElementById('albums-list-view').classList.remove('hidden')
  document.getElementById('album-detail-view').classList.add('hidden')
  currentAlbumId = null
  const c = document.getElementById('albums-container')
  c.innerHTML = '<div class="loading">Cargando albumes...</div>'
  try {
    const albums = await fetchPublic('albums', q => q.order('created_at', { ascending: false }))
    if (!albums.length) { c.innerHTML = '<p class="no-data">Aun no hay albumes. Crea el primero!</p>'; return }
    c.innerHTML = '<div class="albums-grid"></div>'
    const grid = c.querySelector('.albums-grid')

    // Fetch all album_photos for thumbnails
    const allLinks = await fetchPublic('album_photos')
    const linksByAlbum = {}
    allLinks.forEach(l => {
      if (!linksByAlbum[l.album_id]) linksByAlbum[l.album_id] = []
      linksByAlbum[l.album_id].push(l.photo_id)
    })

    // Get up to 4 photo URLs per album (latest)
    const photoIdsToFetch = new Set()
    const thumbIds = {}
    albums.forEach(a => {
      const ids = (linksByAlbum[a.id] || []).reverse().slice(0, 4)
      thumbIds[a.id] = ids
      ids.forEach(id => photoIdsToFetch.add(id))
    })

    let photoUrlMap = {}
    if (photoIdsToFetch.size) {
      const photos = await fetchPublic('photos', q => q.in('id', Array.from(photoIdsToFetch)))
      photoUrlMap = {}
      photos.forEach(p => { photoUrlMap[p.id] = p.image_url })
    }

    albums.forEach(a => {
      const card = document.createElement('div')
      card.className = 'album-card'
      const thumbs = thumbIds[a.id] || []
      const thumbsHtml = thumbs.length
        ? `<div class="album-card-thumbs">${thumbs.map(id => photoUrlMap[id] ? `<img src="${photoUrlMap[id]}" alt="" />` : '').join('')}</div>`
        : ''
      card.innerHTML = `${thumbsHtml}<div class="album-card-title">${a.title}</div><div class="album-card-desc">${a.description || ''}</div><div class="album-card-date">${formatDate(a.created_at)}</div>`
      card.addEventListener('click', () => openAlbum(a))
      grid.appendChild(card)
    })
  } catch (e) { c.innerHTML = `<p class="error-msg">Error: ${e.message}</p>` }
}

async function openAlbum(album) {
  currentAlbumId = album.id
  document.getElementById('albums-list-view').classList.add('hidden')
  document.getElementById('album-detail-view').classList.remove('hidden')
  document.getElementById('album-detail-title').textContent = album.title
  document.getElementById('album-detail-desc').textContent = album.description || ''
  document.getElementById('album-add-photos-btn').onclick = requireAuth(() => showAddPhotosModal())
  document.getElementById('album-delete-btn').onclick = requireAuth(() => deleteAlbum(album.id))
  loadAlbumPhotos(album.id)
}

async function loadAlbumPhotos(albumId) {
  const c = document.getElementById('album-photos-container')
  c.innerHTML = '<div class="loading">Cargando fotos...</div>'
  try {
    const links = await fetchPublic('album_photos', q => q.eq('album_id', albumId))
    if (!links.length) { c.innerHTML = '<p class="no-data">Este album esta vacio. Agrega fotos!</p>'; return }

    const photoIds = links.map(l => l.photo_id)
    const photos = await fetchPublic('photos', q => q.in('id', photoIds).order('created_at', { ascending: false }))

    c.innerHTML = '<div class="gallery-grid"></div>'
    const grid = c.querySelector('.gallery-grid')
    photos.forEach(p => {
      const card = document.createElement('div')
      card.className = 'photo-card'
      card.style.position = 'relative'
      card.innerHTML = `<img src="${p.image_url}" alt="${p.title}" loading="lazy" /><div class="photo-info"><div class="photo-title">${p.title}</div></div>`
      card.addEventListener('click', () => openPhotoModal(p))
      grid.appendChild(card)
    })
  } catch (e) { c.innerHTML = `<p class="error-msg">Error: ${e.message}</p>` }
}

document.getElementById('album-back-btn').addEventListener('click', loadAlbums)

// Create album
document.getElementById('create-album-btn').addEventListener('click', () => {
  if (!isLoggedIn()) { pendingAction = () => document.getElementById('create-album-btn').click(); showLoginModal(); return }
  document.getElementById('album-form-modal').classList.remove('hidden')
  document.getElementById('album-form-name').value = ''
  document.getElementById('album-form-desc').value = ''
  document.getElementById('album-form-error').textContent = ''
  document.getElementById('album-form-name').focus()
})

document.getElementById('album-form-close').addEventListener('click', () => document.getElementById('album-form-modal').classList.add('hidden'))

document.getElementById('album-form-save').addEventListener('click', async () => {
  const title = document.getElementById('album-form-name').value.trim()
  const desc = document.getElementById('album-form-desc').value.trim()
  const err = document.getElementById('album-form-error')
  if (!title) { err.textContent = 'Escribe un titulo'; return }
  try {
    await api('create_album', { title, description: desc })
    document.getElementById('album-form-modal').classList.add('hidden')
    toast('Album creado!'); loadAlbums()
  } catch (e) { err.textContent = e.message }
})

// Add photos to album
async function showAddPhotosModal() {
  if (!isLoggedIn()) { pendingAction = showAddPhotosModal; showLoginModal(); return }
  selectedPhotos.clear()
  document.getElementById('add-photos-modal').classList.remove('hidden')
  document.getElementById('add-photos-error').textContent = ''
  updateSelectedCount()

  const grid = document.getElementById('add-photos-grid')
  grid.innerHTML = '<div class="loading">Cargando...</div>'
  try {
    const photos = await fetchPublic('photos', q => q.order('created_at', { ascending: false }))
    const links = await fetchPublic('album_photos', q => q.eq('album_id', currentAlbumId))
    const existingIds = new Set(links.map(l => l.photo_id))

    grid.innerHTML = ''
    photos.forEach(p => {
      const item = document.createElement('div')
      item.className = 'selectable-photo' + (existingIds.has(p.id) ? ' already-added' : '')
      item.innerHTML = `<img src="${p.image_url}" alt="${p.title}" loading="lazy" /><span class="selectable-check">✓</span><div class="selectable-label">${existingIds.has(p.id) ? 'Ya en el album' : p.title}</div>`
      if (!existingIds.has(p.id)) {
        item.addEventListener('click', () => {
          if (selectedPhotos.has(p.id)) { selectedPhotos.delete(p.id); item.classList.remove('selected') }
          else { selectedPhotos.add(p.id); item.classList.add('selected') }
          updateSelectedCount()
        })
      }
      grid.appendChild(item)
    })
    if (!photos.length) grid.innerHTML = '<p class="no-data">No hay fotos disponibles.</p>'
  } catch (e) { grid.innerHTML = `<p class="error-msg">Error: ${e.message}</p>` }
}

function updateSelectedCount() {
  document.getElementById('add-photos-count').textContent = selectedPhotos.size > 0 ? `${selectedPhotos.size} seleccionadas` : ''
}

document.getElementById('add-photos-close').addEventListener('click', () => document.getElementById('add-photos-modal').classList.add('hidden'))

document.getElementById('add-photos-confirm').addEventListener('click', async () => {
  if (selectedPhotos.size === 0) { document.getElementById('add-photos-error').textContent = 'Selecciona al menos una foto'; return }
  try {
    await api('add_photos_to_album', { album_id: currentAlbumId, photo_ids: Array.from(selectedPhotos) })
    document.getElementById('add-photos-modal').classList.add('hidden')
    toast('Fotos agregadas!'); loadAlbumPhotos(currentAlbumId)
  } catch (e) { document.getElementById('add-photos-error').textContent = e.message }
})

async function deleteAlbum(id) {
  if (!confirm('Borrar este album? Las fotos no se borran, solo se desvinculan.')) return
  await api('delete_album', { id })
  toast('Album borrado'); loadAlbums()
}

// ============================================================
// LETTERS (CARTAS)
// ============================================================
document.getElementById('letter-pdf-file').addEventListener('change', function() {
  document.getElementById('letter-pdf-name').textContent = this.files[0] ? this.files[0].name : ''
})

async function loadLetters() {
  const c = document.getElementById('letters-container')
  c.innerHTML = '<div class="loading">Cargando cartas...</div>'
  try {
    const letters = await fetchPublic('letters', q => q.order('created_at', { ascending: false }))
    if (!letters.length) { c.innerHTML = '<p class="no-data">Aun no hay cartas.</p>'; return }
    c.innerHTML = '<div class="letters-list"></div>'
    const list = c.querySelector('.letters-list')
    letters.forEach(l => {
      const card = document.createElement('div')
      card.className = 'letter-card'
      const isImage = l.pdf_url && l.pdf_name && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(l.pdf_name)
      const pdfId = `pdf-${l.id}`

      card.innerHTML = `
        <div class="letter-header"><span class="letter-title">${l.title}</span><span class="letter-date">${formatDate(l.created_at)}</span></div>
        <div class="letter-content">${l.content || ''}</div>
        ${l.pdf_url ? (isImage
          ? `<div class="letter-attachment-wrap"><img src="${l.pdf_url}" alt="${l.pdf_name}" class="letter-attachment-img letter-attachment-img-clickable" data-url="${l.pdf_url}" data-title="${l.title}" /></div>`
          : `<div id="${pdfId}" class="pdf-viewer" data-url="${l.pdf_url}"><div class="pdf-viewer-loading">Cargando PDF...</div></div>`
        ) : ''}
        <div class="letter-actions">
          <button class="sv-btn sv-btn-small edit-letter-btn" data-id="${l.id}">Editar</button>
          <button class="sv-btn sv-btn-small sv-btn-danger delete-letter-btn" data-id="${l.id}">Borrar</button>
        </div>`
      list.appendChild(card)

      if (l.pdf_url && !isImage) {
        renderPDF(pdfId, l.pdf_url)
      }
    })
    list.querySelectorAll('.edit-letter-btn').forEach(b => b.addEventListener('click', () => {
      (requireAuth(() => editLetter(b.dataset.id)))()
    }))
    list.querySelectorAll('.delete-letter-btn').forEach(b => b.addEventListener('click', () => {
      (requireAuth(() => deleteLetter(b.dataset.id)))()
    }))
    list.querySelectorAll('.letter-attachment-img-clickable').forEach(img => {
      img.addEventListener('click', () => {
        openPhotoModal({
          id: null,
          image_url: img.dataset.url,
          title: img.dataset.title,
          description: '',
          created_at: null,
          favorite: false
        })
      })
    })
  } catch (e) { c.innerHTML = `<p class="error-msg">Error: ${e.message}</p>` }
}

document.getElementById('new-letter-btn').addEventListener('click', requireAuth(() => showLetterForm(false)))
document.getElementById('cancel-letter-btn').addEventListener('click', hideLetterForm)

function showLetterForm(editMode = false) {
  document.getElementById('letter-form').classList.remove('hidden')
  document.getElementById('letter-form-title').textContent = editMode ? 'Editar carta' : 'Escribir carta'
  document.getElementById('letter-error').textContent = ''
}

function hideLetterForm() {
  document.getElementById('letter-form').classList.add('hidden')
  document.getElementById('letter-title').value = ''
  document.getElementById('letter-content').value = ''
  document.getElementById('letter-pdf-file').value = ''
  document.getElementById('letter-pdf-name').textContent = ''
  document.getElementById('letter-error').textContent = ''
  editingLetterId = null
}

async function editLetter(id) {
  const letters = await fetchPublic('letters')
  const l = letters.find(ll => ll.id === id)
  if (!l) return
  editingLetterId = id
  document.getElementById('letter-title').value = l.title
  document.getElementById('letter-content').value = l.content || ''
  showLetterForm(true)
}

document.getElementById('save-letter-btn').addEventListener('click', async () => {
  const title = document.getElementById('letter-title').value.trim()
  const content = document.getElementById('letter-content').value.trim()
  const pdfInput = document.getElementById('letter-pdf-file')
  const errEl = document.getElementById('letter-error')
  errEl.textContent = ''
  if (!title) { errEl.textContent = 'Escribe un titulo'; return }

  try {
    let pdfUrl = null, pdfName = null
    if (pdfInput.files[0]) {
      const file = pdfInput.files[0]
      const fn = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: upErr } = await sbClient.storage.from('letters').upload(fn, file, { cacheControl: '3600', upsert: false })
      if (upErr) throw upErr
      const { data: urlData } = sbClient.storage.from('letters').getPublicUrl(fn)
      pdfUrl = urlData.publicUrl; pdfName = file.name
    }
    if (editingLetterId) {
      await api('update_letter', { id: editingLetterId, title, content, ...(pdfUrl ? { pdf_url: pdfUrl, pdf_name: pdfName } : {}) })
    } else {
      await api('create_letter', { title, content, pdf_url: pdfUrl, pdf_name: pdfName })
    }
    toast(editingLetterId ? 'Carta actualizada' : 'Carta guardada')
    hideLetterForm(); loadLetters()
  } catch (e) { errEl.textContent = e.message }
})

async function deleteLetter(id) {
  if (!confirm('Borrar esta carta?')) return
  await api('delete_letter', { id })
  toast('Carta borrada'); loadLetters()
}

// ============================================================
// PDF RENDERER (custom, styled)
// ============================================================
async function renderPDF(containerId, url) {
  const container = document.getElementById(containerId)
  if (!container) return

  try {
    const pdf = await pdfjsLib.getDocument(url).promise
    container.innerHTML = ''

    const nav = document.createElement('div')
    nav.className = 'pdf-nav'

    const prevBtn = document.createElement('button')
    prevBtn.className = 'sv-btn sv-btn-small'
    prevBtn.textContent = '◀'
    prevBtn.disabled = true

    const pageInfo = document.createElement('span')
    pageInfo.className = 'pdf-page-info'

    const nextBtn = document.createElement('button')
    nextBtn.className = 'sv-btn sv-btn-small'
    nextBtn.textContent = '▶'

    const canvas = document.createElement('canvas')
    canvas.className = 'pdf-canvas'
    container.appendChild(canvas)

    nav.appendChild(prevBtn)
    nav.appendChild(pageInfo)
    nav.appendChild(nextBtn)
    container.appendChild(nav)

    let currentPage = 1

    async function renderPage(pageNum) {
      const page = await pdf.getPage(pageNum)
      const vp = page.getViewport({ scale: 1.5 })
      canvas.width = vp.width
      canvas.height = vp.height
      const ctx = canvas.getContext('2d')
      await page.render({ canvasContext: ctx, viewport: vp }).promise
      pageInfo.textContent = `${pageNum} / ${pdf.numPages}`
      prevBtn.disabled = pageNum <= 1
      nextBtn.disabled = pageNum >= pdf.numPages
      currentPage = pageNum
    }

    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) renderPage(currentPage - 1)
    })
    nextBtn.addEventListener('click', () => {
      if (currentPage < pdf.numPages) renderPage(currentPage + 1)
    })

    renderPage(1)
  } catch (e) {
    container.innerHTML = `<p class="error-msg">Error al cargar PDF</p>`
    console.error('PDF render error:', e)
  }
}



// ============================================================
// INIT
// ============================================================
async function init() {
  const pw = getPassword()
  if (pw) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw, action: 'login' })
      })
      const data = await res.json()
      if (!data.success) clearPassword()
      else if (data.album_name) document.title = data.album_name
    } catch (e) { /* stay logged in optimistically */ }
  }
  loadGallery()
}

init()
