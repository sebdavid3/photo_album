// ============================================================
// CONFIG - Se inyecta desde config.js (generado por scripts/generate-config.sh)
// Las variables se configuran en el dashboard de Vercel
// ============================================================
const APP_CONFIG = window.APP_CONFIG || {}
const SUPABASE_URL = APP_CONFIG.SUPABASE_URL || ''
const SUPABASE_ANON_KEY = APP_CONFIG.SUPABASE_ANON_KEY || ''
const API_URL = SUPABASE_URL + '/functions/v1/api'

// ============================================================
// STATE
// ============================================================
let currentPassword = ''
let currentPhotoId = null
let editingLetterId = null

// ============================================================
// SUPABASE CLIENT (para Storage)
// ============================================================
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ============================================================
// HELPERS
// ============================================================

function getPassword() {
  return sessionStorage.getItem('album_password') || ''
}

function setPassword(pw) {
  sessionStorage.setItem('album_password', pw)
  currentPassword = pw
}

function clearPassword() {
  sessionStorage.removeItem('album_password')
  currentPassword = ''
}

function isLoggedIn() {
  return !!getPassword()
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-ES', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function showToast(msg) {
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = msg
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 3000)
}

// ============================================================
// API CALLS
// ============================================================

async function api(action, data = {}) {
  const password = getPassword()
  if (!password) throw new Error('No autenticado')

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, action, ...data })
  })

  const result = await response.json()

  if (!response.ok) {
    if (response.status === 401) {
      clearPassword()
      showLogin()
      throw new Error('Sesion expirada. Inicia sesion de nuevo.')
    }
    throw new Error(result.error || 'Error del servidor')
  }

  return result
}

// ============================================================
// LOGIN
// ============================================================

function showLogin() {
  document.getElementById('login-overlay').style.display = 'flex'
  document.getElementById('main-menu').style.display = 'none'
  document.getElementById('password-input').value = ''
  document.getElementById('login-error').textContent = ''
  document.getElementById('photo-modal').classList.add('hidden')
}

function showMainMenu() {
  document.getElementById('login-overlay').style.display = 'none'
  document.getElementById('main-menu').style.display = 'flex'
}

async function handleLogin() {
  const pw = document.getElementById('password-input').value
  const errorEl = document.getElementById('login-error')

  if (!pw) {
    errorEl.textContent = 'Ingresa la contrasena'
    return
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw, action: 'login' })
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      errorEl.textContent = 'Contrasena incorrecta'
      return
    }

    setPassword(pw)

    // Update album name from server
    if (result.album_name) {
      document.getElementById('album-title-login').textContent = result.album_name
      document.title = result.album_name
    }

    showMainMenu()
    loadPhotos()
  } catch (e) {
    errorEl.textContent = 'Error al conectar con el servidor'
    console.error(e)
  }
}

document.getElementById('login-btn').addEventListener('click', handleLogin)
document.getElementById('password-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin()
})

// Exit button
document.getElementById('exit-btn').addEventListener('click', () => {
  clearPassword()
  showLogin()
})

// ============================================================
// TAB SWITCHING
// ============================================================

function openTab(evt, tabName) {
  // Show correct content
  const contents = document.getElementsByClassName('content')
  for (let i = 0; i < contents.length; i++) {
    contents[i].style.display = 'none'
  }
  document.getElementById(tabName).style.display = 'block'

  // Show active tab
  const tabs = document.getElementsByClassName('menu__tab')
  for (let i = 0; i < tabs.length; i++) {
    tabs[i].className = tabs[i].className.replace(' menu__tab--active', '')
  }
  evt.currentTarget.className += ' menu__tab--active'

  // Load data for tab
  if (tabName === 'galeria') loadPhotos()
  if (tabName === 'cartas') loadLetters()
  if (tabName === 'ajustes') loadSettings()
}

// ============================================================
// GALLERY
// ============================================================

async function loadPhotos() {
  const container = document.getElementById('gallery-container')

  if (!isLoggedIn()) return

  container.innerHTML = '<div class="loading">Cargando recuerdos...</div>'

  try {
    const result = await api('get_photos')
    const photos = result.photos || []

    if (photos.length === 0) {
      container.innerHTML = '<p class="no-data">Aun no hay recuerdos. Sube la primera foto!</p>'
      return
    }

    container.innerHTML = '<div class="gallery-grid"></div>'
    const grid = container.querySelector('.gallery-grid')

    photos.forEach(photo => {
      const card = document.createElement('div')
      card.className = 'photo-card'
      card.style.position = 'relative'
      card.innerHTML = `
        <img src="${photo.image_url}" alt="${photo.title}" loading="lazy" />
        ${photo.favorite ? '<span class="photo-fav" title="Favorito">⭐</span>' : ''}
        <div class="photo-info">
          <div class="photo-title">${photo.title}</div>
          <div class="photo-date">${formatDate(photo.created_at)}</div>
        </div>
      `
      card.addEventListener('click', () => openPhotoModal(photo))
      grid.appendChild(card)
    })

  } catch (e) {
    container.innerHTML = `<p class="error-msg">Error al cargar fotos: ${e.message}</p>`
    console.error(e)
  }
}

// ============================================================
// PHOTO MODAL
// ============================================================

function openPhotoModal(photo) {
  currentPhotoId = photo.id
  document.getElementById('modal-img').src = photo.image_url
  document.getElementById('modal-title').textContent = photo.title
  document.getElementById('modal-desc').textContent = photo.description || ''
  document.getElementById('modal-date').textContent = formatDate(photo.created_at)

  const favBtn = document.getElementById('modal-fav-btn')
  favBtn.textContent = photo.favorite ? '⭐ Quitar favorito' : '☆ Marcar favorito'
  favBtn.onclick = () => toggleFavorite(photo.id)

  document.getElementById('modal-delete-btn').onclick = () => deletePhoto(photo.id)

  document.getElementById('photo-modal').classList.remove('hidden')
}

function closePhotoModal() {
  document.getElementById('photo-modal').classList.add('hidden')
  currentPhotoId = null
}

document.getElementById('modal-close').addEventListener('click', closePhotoModal)
document.getElementById('photo-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closePhotoModal()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePhotoModal()
})

async function toggleFavorite(id) {
  try {
    const result = await api('toggle_favorite', { id })
    showToast(result.photo.favorite ? 'Marcado como favorito ⭐' : 'Favorito removido')
    closePhotoModal()
    loadPhotos()
  } catch (e) {
    showToast('Error: ' + e.message)
  }
}

async function deletePhoto(id) {
  if (!confirm('Seguro que quieres borrar este recuerdo? No se puede deshacer.')) return

  try {
    await api('delete_photo', { id })
    showToast('Recuerdo borrado')
    closePhotoModal()
    loadPhotos()
  } catch (e) {
    showToast('Error: ' + e.message)
  }
}

// ============================================================
// UPLOAD
// ============================================================

// File input preview
document.getElementById('photo-file').addEventListener('change', function() {
  const file = this.files[0]
  const nameEl = document.getElementById('photo-file-name')
  const preview = document.getElementById('upload-preview')
  const previewImg = document.getElementById('upload-preview-img')

  if (file) {
    nameEl.textContent = file.name
    preview.classList.remove('hidden')
    previewImg.src = URL.createObjectURL(file)
  } else {
    nameEl.textContent = ''
    preview.classList.add('hidden')
  }
})

async function handleUpload() {
  const fileInput = document.getElementById('photo-file')
  const titleInput = document.getElementById('photo-title')
  const descInput = document.getElementById('photo-desc')
  const errorEl = document.getElementById('upload-error')
  const progressEl = document.getElementById('upload-progress')
  const progressBar = document.getElementById('upload-progress-bar')

  errorEl.textContent = ''

  if (!fileInput.files[0]) {
    errorEl.textContent = 'Selecciona una imagen'
    return
  }
  if (!titleInput.value.trim()) {
    errorEl.textContent = 'Escribe un titulo'
    return
  }

  const file = fileInput.files[0]
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  progressEl.style.display = 'block'
  progressBar.style.width = '30%'

  try {
    // Upload to Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) throw uploadError

    progressBar.style.width = '70%'

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('photos')
      .getPublicUrl(fileName)

    progressBar.style.width = '90%'

    // Save metadata via API
    const result = await api('create_photo', {
      title: titleInput.value.trim(),
      description: descInput.value.trim(),
      image_url: urlData.publicUrl
    })

    progressBar.style.width = '100%'

    showToast('Recuerdo guardado!')

    // Reset form
    fileInput.value = ''
    document.getElementById('photo-file-name').textContent = ''
    document.getElementById('upload-preview').classList.add('hidden')
    titleInput.value = ''
    descInput.value = ''

    // Reload gallery
    setTimeout(() => {
      progressEl.style.display = 'none'
      progressBar.style.width = '0%'
    }, 500)

  } catch (e) {
    errorEl.textContent = 'Error: ' + e.message
    progressEl.style.display = 'none'
    progressBar.style.width = '0%'
    console.error(e)
  }
}

document.getElementById('upload-btn').addEventListener('click', handleUpload)

// ============================================================
// LETTERS (CARTAS)
// ============================================================

// PDF file input
document.getElementById('letter-pdf-file').addEventListener('change', function() {
  const file = this.files[0]
  document.getElementById('letter-pdf-name').textContent = file ? file.name : ''
})

async function loadLetters() {
  const container = document.getElementById('letters-container')

  if (!isLoggedIn()) return

  container.innerHTML = '<div class="loading">Cargando cartas...</div>'

  try {
    const result = await api('get_letters')
    const letters = result.letters || []

    if (letters.length === 0) {
      container.innerHTML = '<p class="no-data">Aun no hay cartas. Escribe la primera!</p>'
      return
    }

    container.innerHTML = '<div class="letters-list"></div>'
    const list = container.querySelector('.letters-list')

    letters.forEach(letter => {
      const card = document.createElement('div')
      card.className = 'letter-card'
      card.innerHTML = `
        <div class="letter-header">
          <span class="letter-title">${letter.title}</span>
          <span class="letter-date">${formatDate(letter.created_at)}</span>
        </div>
        <div class="letter-content">${letter.content || ''}</div>
        ${letter.pdf_url ? `
          <a href="${letter.pdf_url}" target="_blank" class="letter-pdf">
            📎 ${letter.pdf_name || 'Descargar adjunto'}
          </a>
        ` : ''}
        <div class="letter-actions">
          <button class="sv-btn sv-btn-small edit-letter-btn" data-id="${letter.id}">Editar</button>
          <button class="sv-btn sv-btn-small sv-btn-danger delete-letter-btn" data-id="${letter.id}">Borrar</button>
        </div>
      `
      list.appendChild(card)
    })

    // Event listeners for edit/delete buttons
    list.querySelectorAll('.edit-letter-btn').forEach(btn => {
      btn.addEventListener('click', () => editLetter(btn.dataset.id))
    })
    list.querySelectorAll('.delete-letter-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteLetter(btn.dataset.id))
    })

  } catch (e) {
    container.innerHTML = `<p class="error-msg">Error al cargar cartas: ${e.message}</p>`
    console.error(e)
  }
}

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

document.getElementById('new-letter-btn').addEventListener('click', () => showLetterForm(false))
document.getElementById('cancel-letter-btn').addEventListener('click', hideLetterForm)

async function editLetter(id) {
  try {
    const result = await api('get_letters')
    const letter = result.letters.find(l => l.id === id)
    if (!letter) return

    editingLetterId = id
    document.getElementById('letter-title').value = letter.title
    document.getElementById('letter-content').value = letter.content || ''
    showLetterForm(true)
  } catch (e) {
    showToast('Error: ' + e.message)
  }
}

async function saveLetter() {
  const titleInput = document.getElementById('letter-title')
  const contentInput = document.getElementById('letter-content')
  const pdfInput = document.getElementById('letter-pdf-file')
  const errorEl = document.getElementById('letter-error')

  errorEl.textContent = ''

  if (!titleInput.value.trim()) {
    errorEl.textContent = 'Escribe un titulo'
    return
  }

  try {
    let pdfUrl = null
    let pdfName = null

    // Upload PDF if selected
    if (pdfInput.files[0]) {
      const file = pdfInput.files[0]
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('letters')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('letters')
        .getPublicUrl(fileName)

      pdfUrl = urlData.publicUrl
      pdfName = file.name
    }

    if (editingLetterId) {
      // Update existing
      await api('update_letter', {
        id: editingLetterId,
        title: titleInput.value.trim(),
        content: contentInput.value.trim(),
        ...(pdfUrl ? { pdf_url: pdfUrl, pdf_name: pdfName } : {})
      })
      showToast('Carta actualizada')
    } else {
      // Create new
      await api('create_letter', {
        title: titleInput.value.trim(),
        content: contentInput.value.trim(),
        pdf_url: pdfUrl,
        pdf_name: pdfName
      })
      showToast('Carta guardada')
    }

    hideLetterForm()
    loadLetters()

  } catch (e) {
    errorEl.textContent = 'Error: ' + e.message
    console.error(e)
  }
}

document.getElementById('save-letter-btn').addEventListener('click', saveLetter)

async function deleteLetter(id) {
  if (!confirm('Seguro que quieres borrar esta carta?')) return

  try {
    await api('delete_letter', { id })
    showToast('Carta borrada')
    loadLetters()
  } catch (e) {
    showToast('Error: ' + e.message)
  }
}

// ============================================================
// SETTINGS
// ============================================================

async function loadSettings() {
  if (!isLoggedIn()) return

  try {
    const result = await api('get_settings')
    const settings = result.settings
    if (settings) {
      document.getElementById('settings-album-name').value = settings.album_name || ''
    }
    document.getElementById('settings-msg').textContent = ''
  } catch (e) {
    console.error(e)
  }
}

async function saveSettings() {
  const nameInput = document.getElementById('settings-album-name')
  const passwordInput = document.getElementById('settings-new-password')
  const msgEl = document.getElementById('settings-msg')

  msgEl.textContent = ''

  try {
    const data = {}
    if (nameInput.value.trim()) {
      data.album_name = nameInput.value.trim()
    }
    if (passwordInput.value.trim()) {
      data.new_password = passwordInput.value.trim()
    }

    if (Object.keys(data).length === 0) {
      msgEl.textContent = 'No hay cambios para guardar'
      msgEl.className = 'error-msg'
      return
    }

    await api('update_settings', data)

    if (data.new_password) {
      setPassword(passwordInput.value.trim())
      passwordInput.value = ''
    }

    // Update album name in UI
    if (data.album_name) {
      document.getElementById('album-title-login').textContent = data.album_name
      document.title = data.album_name
    }

    msgEl.textContent = 'Cambios guardados correctamente'
    msgEl.className = 'success-msg'

    setTimeout(() => { msgEl.textContent = '' }, 3000)

  } catch (e) {
    msgEl.textContent = 'Error: ' + e.message
    msgEl.className = 'error-msg'
    console.error(e)
  }
}

document.getElementById('save-settings-btn').addEventListener('click', saveSettings)

// ============================================================
// INIT
// ============================================================

async function init() {
  const savedPassword = getPassword()
  if (savedPassword) {
    // Verify saved password is still valid
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: savedPassword, action: 'login' })
      })
      const result = await response.json()
      if (result.success) {
        if (result.album_name) {
          document.getElementById('album-title-login').textContent = result.album_name
          document.title = result.album_name
        }
        showMainMenu()
        loadPhotos()
        return
      }
    } catch (e) {
      // Fall through to show login
    }
    clearPassword()
  }
  showLogin()
}

init()
