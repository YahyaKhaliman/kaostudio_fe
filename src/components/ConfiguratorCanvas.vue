<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed, nextTick } from 'vue'
import { Canvas, IText, FabricImage, FabricObject } from 'fabric'
import { useConfiguratorStore } from '../stores/configurator'
import { processMockupImage, colorizeMockup } from '../utils/mockupProcessor'
import { PhSpinner, PhCursorClick, PhTrash } from '@phosphor-icons/vue'

// Kustomisasi visual garis bantu (bounding box) & tombol kontrol Fabric.js agar bertema premium
FabricObject.ownDefaults.borderColor = '#818cf8' // Indigo-400 lembut
FabricObject.ownDefaults.cornerColor = '#ffffff' // Bulatan sudut putih bersih
FabricObject.ownDefaults.cornerStrokeColor = '#4f46e5' // Outline Indigo-600
FabricObject.ownDefaults.cornerStyle = 'circle' // Bulatan modern lingkaran
FabricObject.ownDefaults.transparentCorners = false // Sudut padat (tidak berongga)
FabricObject.ownDefaults.cornerSize = 8 // Sudut kecil elegan
FabricObject.ownDefaults.borderDashArray = [4, 4] // Garis seleksi putus-putus yang rapi

// Impor aset gambar kaos polos hasil generasi
import tshirtFrontImg from '../assets/images/tshirt-front.png'
import tshirtBackImg from '../assets/images/tshirt-back.png'

const store = useConfiguratorStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let fabricCanvas: Canvas | null = null

const isProcessing = ref(true)
const currentMockupUrl = ref('')
const selectedObject = ref<any>(null)

// Menangani hapus objek lewat tombol Keyboard (Delete / Backspace)
const handleKeyDown = (e: KeyboardEvent) => {
  // Cegah penghapusan jika pengguna sedang mengetik di input form luar
  const activeEl = document.activeElement as HTMLElement | null
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) return

  if (e.key === 'Delete' || e.key === 'Backspace') {
    // Cegah penghapusan jika pengguna sedang mengedit teks di dalam canvas Fabric
    const activeObj = fabricCanvas?.getActiveObject()
    if (activeObj && 'isEditing' in activeObj && (activeObj as any).isEditing) {
      return
    }
    
    deleteSelected()
    e.preventDefault()
  }
}

// Menyimpan referensi mockup hasil pre-proses
let processedFront: HTMLCanvasElement | null = null
let processedBack: HTMLCanvasElement | null = null

// Konfigurasi letak dan ukuran area sablon (chest area) pada canvas mockup 500x500px
const canvasConfigs = {
  front: {
    width: 200,
    height: 270,
    top: 110,
    left: 150
  },
  back: {
    width: 210,
    height: 290,
    top: 100,
    left: 145
  }
}

// Menghitung gaya letak area sablon di UI secara absolute
const printableAreaStyle = computed(() => {
  const config = canvasConfigs[store.currentView]
  return {
    top: `${(config.top / 500) * 100}%`,
    left: `${(config.left / 500) * 100}%`,
    width: `${(config.width / 500) * 100}%`,
    height: `${(config.height / 500) * 100}%`
  }
})

// Melakukan pre-proses gambar kaos untuk memuat gambar transparan ke canvas
const initMockupImages = async () => {
  try {
    isProcessing.value = true
    processedFront = await processMockupImage(tshirtFrontImg)
    processedBack = await processMockupImage(tshirtBackImg)
    updateMockupColor()
  } catch (error) {
    console.error('Gagal memproses gambar mockup:', error)
  } finally {
    isProcessing.value = false
  }
}

// Memperbarui warna kaos secara dinamis berdasarkan state store
const updateMockupColor = () => {
  if (store.currentView === 'front' && processedFront) {
    currentMockupUrl.value = colorizeMockup(processedFront, store.shirtColor)
  } else if (store.currentView === 'back' && processedBack) {
    currentMockupUrl.value = colorizeMockup(processedBack, store.shirtColor)
  }
}

// Menginisialisasi Fabric.js Canvas
const initFabricCanvas = () => {
  if (!canvasRef.value) return

  const config = canvasConfigs[store.currentView]
  fabricCanvas = new Canvas(canvasRef.value, {
    width: config.width,
    height: config.height,
    preserveObjectStacking: true,
    backgroundColor: 'transparent'
  })

  // Daftarkan listener event untuk mendeteksi objek yang dipilih
  initCanvasEvents()
}

const initCanvasEvents = () => {
  if (!fabricCanvas) return

  const updateSelectedObject = () => {
    selectedObject.value = fabricCanvas?.getActiveObject() || null
  }

  fabricCanvas.on('selection:created', updateSelectedObject)
  fabricCanvas.on('selection:updated', updateSelectedObject)
  fabricCanvas.on('selection:cleared', () => {
    selectedObject.value = null
  })
}

// Menyimpan state kanvas saat ini ke Pinia
const saveCurrentState = () => {
  if (fabricCanvas) {
    store.saveCanvasState(store.currentView, fabricCanvas.toJSON())
  }
}

// Memuat state kanvas untuk view tertentu dari Pinia
const loadStateForView = async (view: 'front' | 'back') => {
  if (!fabricCanvas) return
  
  // Hapus semua objek
  fabricCanvas.clear()
  
  const savedState = store.canvasStates[view]
  if (savedState) {
    try {
      await fabricCanvas.loadFromJSON(savedState)
      fabricCanvas.renderAll()
    } catch (e) {
      console.error('Gagal memuat state kanvas:', e)
    }
  }
}

// Mengubah ukuran kanvas saat berpindah sisi kaos
const resizeCanvas = (view: 'front' | 'back') => {
  if (!fabricCanvas) return
  const config = canvasConfigs[view]
  fabricCanvas.setDimensions({
    width: config.width,
    height: config.height
  })
  fabricCanvas.renderAll()
}

// Watcher untuk mendeteksi perubahan sisi kaos
watch(
  () => store.currentView,
  async (newView, oldView) => {
    if (oldView) {
      saveCurrentState()
    }
    updateMockupColor()
    resizeCanvas(newView)
    await loadStateForView(newView)
    // Clear selection
    if (fabricCanvas) {
      fabricCanvas.discardActiveObject()
      fabricCanvas.renderAll()
      selectedObject.value = null
    }
  }
)

// Watcher untuk mendeteksi perubahan warna kaos
watch(
  () => store.shirtColor,
  () => {
    updateMockupColor()
  }
)

// Inisialisasi awal saat komponen dipasang
onMounted(async () => {
  initFabricCanvas()
  await initMockupImages()
  window.addEventListener('keydown', handleKeyDown)
})

// Simpan state sebelum dihancurkan
onUnmounted(() => {
  saveCurrentState()
  window.removeEventListener('keydown', handleKeyDown)
  if (fabricCanvas) {
    fabricCanvas.dispose()
    fabricCanvas = null
  }
})

// ==========================================
// FUNGSI MANIPULASI OBJEK FABRIC (EXPOSED)
// ==========================================

const addText = (textVal: string, color = '#000000', fontFamily = 'Inter') => {
  if (!fabricCanvas) return
  const config = canvasConfigs[store.currentView]
  
  const text = new IText(textVal, {
    left: config.width / 2 - 50,
    top: config.height / 2 - 20,
    fontSize: 24,
    fill: color,
    fontFamily: fontFamily,
    editable: true
  })
  
  fabricCanvas.add(text)
  fabricCanvas.setActiveObject(text)
  fabricCanvas.renderAll()
}

const addImage = (source: File | string) => {
  if (!fabricCanvas) return
  const config = canvasConfigs[store.currentView]
  
  const loadAndAddToCanvas = (url: string) => {
    const imgEl = new Image()
    imgEl.onload = () => {
      const fabricImg = new FabricImage(imgEl, {
        left: config.width / 2 - 60,
        top: config.height / 2 - 60,
      })
      
      // Hitung skala agar tidak terlalu besar
      const maxW = 120
      const maxH = 120
      let scale = 1
      if (fabricImg.width! > maxW || fabricImg.height! > maxH) {
        scale = Math.min(maxW / fabricImg.width!, maxH / fabricImg.height!)
      }
      
      fabricImg.set({
        scaleX: scale,
        scaleY: scale
      })
      
      fabricCanvas!.add(fabricImg)
      fabricCanvas!.setActiveObject(fabricImg)
      fabricCanvas!.renderAll()
    }
    imgEl.src = url
  }

  if (typeof source === 'string') {
    loadAndAddToCanvas(source)
  } else {
    const reader = new FileReader()
    reader.onload = (e) => {
      const url = e.target?.result as string
      loadAndAddToCanvas(url)
    }
    reader.readAsDataURL(source)
  }
}

const deleteSelected = () => {
  if (!fabricCanvas) return
  const activeObject = fabricCanvas.getActiveObject()
  if (!activeObject) return

  // Jika objek yang aktif berupa seleksi grup (multi-select)
  if (activeObject.type === 'activeSelection') {
    const activeSelection = activeObject as any
    const objectsInSelection = activeSelection.getObjects()
    if (objectsInSelection.length > 0) {
      // Hapus hanya satu objek terakhir dalam seleksi grup tersebut
      const targetObj = objectsInSelection[objectsInSelection.length - 1]
      fabricCanvas.remove(targetObj)
    }
  } else {
    // Hapus objek tunggal aktif
    fabricCanvas.remove(activeObject)
  }
  
  fabricCanvas.discardActiveObject()
  fabricCanvas.renderAll()
}

const bringToFront = () => {
  const obj = fabricCanvas?.getActiveObject()
  if (obj && fabricCanvas) {
    fabricCanvas.bringObjectToFront(obj)
    fabricCanvas.renderAll()
  }
}

const sendToBack = () => {
  const obj = fabricCanvas?.getActiveObject()
  if (obj && fabricCanvas) {
    fabricCanvas.sendObjectToBack(obj)
    fabricCanvas.renderAll()
  }
}

// Ekspor File Cetak Sablon Saja (Transparan)
const exportPrint = (): string => {
  if (!fabricCanvas) return ''
  fabricCanvas.discardActiveObject()
  fabricCanvas.renderAll()
  
  return fabricCanvas.toDataURL({
    format: 'png',
    multiplier: 4 // Perbesar resolusi untuk produksi cetak
  })
}

// Menghitung gaya latar belakang wadah mockup secara dinamis
const containerBackdropStyle = computed(() => {
  if (store.backdropType === 'solid') {
    return { backgroundColor: store.backdropColor }
  } else if (store.backdropType === 'custom' && store.customBackdropUrl) {
    return {
      backgroundImage: `url(${store.customBackdropUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }
  return {}
})

// Fungsi asinkronus untuk menggambar backdrop pada canvas ekspor
const drawBackdrop = (ctx: CanvasRenderingContext2D, w: number, h: number): Promise<void> => {
  return new Promise((resolve) => {
    if (store.backdropType === 'solid') {
      ctx.fillStyle = store.backdropColor
      ctx.fillRect(0, 0, w, h)
      resolve()
    } else if (store.backdropType === 'gradient') {
      // Efek dinding studio semen bersih (radial gradient terang ke abu-abu netral)
      const grad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, Math.max(w, h) / 1.2)
      grad.addColorStop(0, '#f8fafc') // Slate-50 (pusat sorotan lampu studio)
      grad.addColorStop(1, '#cbd5e1') // Slate-300 (tepi dinding studio abu-abu)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
      resolve()
    } else if (store.backdropType === 'checkerboard') {
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#1e293b' // Slate-800
      const size = 20
      for (let y = 0; y < h; y += size) {
        for (let x = 0; x < w; x += size) {
          if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) {
            ctx.fillRect(x, y, size, size)
          }
        }
      }
      resolve()
    } else if (store.backdropType === 'custom' && store.customBackdropUrl) {
      const bgImg = new Image()
      bgImg.crossOrigin = 'anonymous'
      bgImg.onload = () => {
        const scale = Math.max(w / bgImg.width, h / bgImg.height)
        const x = (w - bgImg.width * scale) / 2
        const y = (h - bgImg.height * scale) / 2
        ctx.drawImage(bgImg, x, y, bgImg.width * scale, bgImg.height * scale)
        resolve()
      }
      bgImg.onerror = () => {
        ctx.fillStyle = '#090d16'
        ctx.fillRect(0, 0, w, h)
        resolve()
      }
      bgImg.src = store.customBackdropUrl
    } else {
      ctx.fillStyle = '#090d16'
      ctx.fillRect(0, 0, w, h)
      resolve()
    }
  })
}

// Ekspor Gambar Mockup Lengkap dengan Kaos
const exportMockup = (): Promise<string> => {
  return new Promise((resolve) => {
    if (!fabricCanvas) {
      resolve('')
      return
    }
    fabricCanvas.discardActiveObject()
    fabricCanvas.renderAll()

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      const exportCanvas = document.createElement('canvas')
      exportCanvas.width = img.width
      exportCanvas.height = img.height
      const ctx = exportCanvas.getContext('2d')
      if (!ctx) {
        resolve('')
        return
      }

      // Gambar warna/tipe latar belakang terpilih
      await drawBackdrop(ctx, img.width, img.height)

      // Gambar warna kaos di atas backdrop
      ctx.drawImage(img, 0, 0)

      // Ambil desain dari canvas sablon
      const canvasImg = new Image()
      canvasImg.src = fabricCanvas!.toDataURL({ format: 'png', multiplier: 1 })
      canvasImg.onload = () => {
        const config = canvasConfigs[store.currentView]
        
        // Sesuaikan skala koordinat jika ukuran asli berbeda dari 500x500
        const scaleX = img.width / 500
        const scaleY = img.height / 500

        ctx.drawImage(
          canvasImg,
          config.left * scaleX,
          config.top * scaleY,
          config.width * scaleX,
          config.height * scaleY
        )
        resolve(exportCanvas.toDataURL('image/jpeg', 0.95))
      }
    }
    img.src = currentMockupUrl.value
  })
}

const updateSelectedText = (val: string) => {
  if (!fabricCanvas) return
  const obj = fabricCanvas.getActiveObject()
  if (obj && (obj instanceof IText || obj.type === 'i-text' || obj.type === 'text')) {
    obj.set({ text: val })
    fabricCanvas.renderAll()
  }
}

const updateSelectedColor = (val: string) => {
  if (!fabricCanvas) return
  const obj = fabricCanvas.getActiveObject()
  if (obj) {
    obj.set({ fill: val })
    fabricCanvas.renderAll()
  }
}

const updateSelectedFont = (val: string) => {
  if (!fabricCanvas) return
  const obj = fabricCanvas.getActiveObject()
  if (obj && (obj instanceof IText || obj.type === 'i-text' || obj.type === 'text')) {
    obj.set({ fontFamily: val })
    fabricCanvas.renderAll()
  }
}

const updateSelectedFontSize = (val: number) => {
  if (!fabricCanvas) return
  const obj = fabricCanvas.getActiveObject()
  if (obj && (obj instanceof IText || obj.type === 'i-text' || obj.type === 'text')) {
    obj.set({ fontSize: val })
    fabricCanvas.renderAll()
  }
}

const deselectObject = () => {
  if (fabricCanvas) {
    fabricCanvas.discardActiveObject()
    fabricCanvas.renderAll()
  }
}

defineExpose({
  addText,
  addImage,
  deleteSelected,
  bringToFront,
  sendToBack,
  exportPrint,
  exportMockup,
  selectedObject,
  fabricCanvas,
  updateSelectedText,
  updateSelectedColor,
  updateSelectedFont,
  updateSelectedFontSize,
  deselectObject
})
</script>

<template>
  <div class="flex flex-col items-center justify-center p-2 w-full">
    <!-- Container Mockup Kaos -->
    <div 
      class="relative w-[500px] h-[500px] rounded-3xl flex items-center justify-center overflow-hidden border border-sky-100 transition-all duration-300 shadow-lg bg-white"
      :class="{
        'bg-checkerboard-light': store.backdropType === 'checkerboard',
        'bg-studio-wall': store.backdropType === 'gradient'
      }"
      :style="containerBackdropStyle"
    >
      
      <!-- Overlay Loading Proses Background Removal -->
      <div v-if="isProcessing" class="absolute inset-0 bg-white/90 backdrop-blur-md z-20 flex flex-col items-center justify-center space-y-4">
        <PhSpinner class="animate-spin h-10 w-10 text-sky-600" :size="38" weight="bold" />
        <span class="text-slate-700 text-sm font-semibold tracking-wide">Menghapus background mockup...</span>
      </div>

      <!-- Lapisan Kaos Mockup (Dengan filter drop-shadow agar kaos terlihat timbul 3D) -->
      <img
        v-if="currentMockupUrl"
        :src="currentMockupUrl"
        class="absolute inset-0 w-full h-full object-contain pointer-events-none select-none filter drop-shadow-[0_25px_35px_rgba(0,0,0,0.18)]"
        alt="Mockup Kaos"
      />

      <!-- Area Bounding Box / Sablon (Konsisten dengan tema Sky Blue) -->
      <div
        class="absolute border border-dashed border-sky-400/30 rounded-xl flex items-center justify-center bg-white/[0.01] hover:border-sky-500/60 hover:bg-sky-500/[0.02] transition-all duration-300 group/area"
        :class="{ 'border-sky-500/65 bg-sky-500/[0.01] shadow-[0_0_20px_rgba(14,165,233,0.1)]': selectedObject }"
        :style="printableAreaStyle"
      >
        <canvas ref="canvasRef"></canvas>
        
        <!-- Label Area Cetak (Muncul saat tidak ada objek yang dipilih) -->
        <span 
          v-if="!selectedObject" 
          class="absolute bottom-2 text-[8px] bg-white text-sky-850 border border-sky-200 px-2 py-0.5 backdrop-blur-sm rounded-md pointer-events-none tracking-widest uppercase font-black shadow-sm"
        >
          Area Sablon
        </span>
      </div>

      <!-- Tombol Hapus Melayang untuk Akses Cepat / Layar Sentuh (Light Glassmorphism Red Accent) -->
      <button 
        v-if="selectedObject"
        @click="deleteSelected"
        class="absolute top-4 right-4 z-30 bg-white/95 hover:bg-red-500 border border-red-200/60 hover:border-red-500/30 text-red-600 hover:text-white py-2.5 px-3 rounded-xl shadow-md transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-1.5 backdrop-blur-md group"
        title="Hapus elemen terpilih (Bisa tekan Delete/Backspace)"
      >
        <PhTrash :size="14" weight="bold" />
        <span class="text-[10px] font-black uppercase tracking-wider">Hapus Elemen</span>
      </button>
    </div>

    <!-- Petunjuk Singkat -->
    <div class="mt-6 flex items-center justify-center gap-6 text-xs text-slate-650">
      <span class="flex items-center gap-1.5 bg-white/80 border border-sky-100 px-2.5 py-1 rounded-lg shadow-sm">
        <span class="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block animate-pulse"></span> 
        Area Sablon Dibatasi
      </span>
      <span class="flex items-center gap-1.5 bg-white/80 border border-sky-100 px-2.5 py-1 rounded-lg shadow-sm">
        <PhCursorClick class="text-sky-600" :size="14" weight="bold" /> 
        Klik ganda teks untuk mengubah isi
      </span>
    </div>
  </div>
</template>

<style scoped>
/* Menghilangkan border outline pada canvas Fabric */
.canvas-container {
  outline: none !important;
}

/* Pola catur transparan ramah tema terang untuk backdrop (Photoshop style) */
.bg-checkerboard-light {
  background-image: linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
    linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
    linear-gradient(-45deg, transparent 75%, #e2e8f0 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  background-color: #ffffff;
}

/* Latar belakang dinding studio semen bersih (radial vignette) */
.bg-studio-wall {
  background: radial-gradient(circle, #f8fafc 0%, #cbd5e1 100%);
}
</style>
