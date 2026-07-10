import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ViewType = 'front' | 'back' | 'both'
export type CanvasViewType = 'front' | 'back'
export type ShirtType = 'tshirt' | 'longTshirt' | 'polo'

// Helper generator UUID fallback untuk mengatasi lingkungan non-HTTPS di production
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const useConfiguratorStore = defineStore('configurator', () => {
  const currentView = ref<ViewType>('front')
  const shirtColor = ref<string>('#ffffff') // default white
  const currentShirtType = ref<ShirtType>('tshirt')
  
  // Menyimpan state JSON Fabric.js untuk masing-masing view (depan & belakang)
  const canvasStates = ref<Record<CanvasViewType, any>>({
    front: null,
    back: null
  })

  // Menyimpan data URL PNG desain sablon transparan untuk rendering preview statis kedua sisi
  const frontDesignUrl = ref<string | null>(null)
  const backDesignUrl = ref<string | null>(null)

  // Menyimpan status modifikasi/keberadaan objek sablon pada masing-masing sisi
  const isFrontDirty = ref(false)
  const isBackDirty = ref(false)

  // Panduan ukuran kaos perusahaan
  const shirtSizes = {
    S: { length: 67, width: 47 },
    M: { length: 69, width: 49 },
    L: { length: 71, width: 51 },
    XL: { length: 73, width: 53 },
    XXL: { length: 75, width: 55 },
    XXXL: { length: 77, width: 57 }
  }

  // Menyimpan ukuran kaos aktif (S, M, L, XL, XXL, XXXL)
  const currentSize = ref<'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL'>('L')

  const backdropType = ref<'solid' | 'checkerboard' | 'gradient' | 'custom'>('gradient')
  const backdropColor = ref<string>('#0f172a') // default dark slate
  const customBackdropUrl = ref<string | null>(null)

  // Storage sementara untuk menyimpan gambar yang diunggah oleh user
  const uploadedImages = ref<{
    id: string
    name: string
    dataUrl: string
    size: number
    originalSize: number
  }[]>([])

  const saveCanvasState = (view: CanvasViewType, jsonState: any) => {
    canvasStates.value[view] = jsonState
  }

  const addUploadedImage = (name: string, dataUrl: string, size: number, originalSize: number) => {
    // Batasi kapasitas cache sementara maksimal 6 gambar kustom untuk mengamankan memori
    if (uploadedImages.value.length >= 6) {
      uploadedImages.value.shift()
    }
    uploadedImages.value.push({
      id: generateUUID(),
      name,
      dataUrl,
      size,
      originalSize
    })
  }

  const removeUploadedImage = (id: string) => {
    uploadedImages.value = uploadedImages.value.filter((img) => img.id !== id)
  }

  const saveToLocalStorage = () => {
    const dataToSave = {
      shirtColor: shirtColor.value,
      currentShirtType: currentShirtType.value,
      backdropType: backdropType.value,
      backdropColor: backdropColor.value,
      customBackdropUrl: customBackdropUrl.value,
      currentSize: currentSize.value,
      canvasStates: canvasStates.value
    }
    localStorage.setItem('kaostudio_autosave', JSON.stringify(dataToSave))
  }

  const loadFromLocalStorage = () => {
    const saved = localStorage.getItem('kaostudio_autosave')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (data.shirtColor) shirtColor.value = data.shirtColor
        if (data.currentShirtType) currentShirtType.value = data.currentShirtType
        if (data.backdropType) backdropType.value = data.backdropType
        if (data.backdropColor) backdropColor.value = data.backdropColor
        if (data.customBackdropUrl) customBackdropUrl.value = data.customBackdropUrl
        if (data.currentSize) currentSize.value = data.currentSize
        if (data.canvasStates) {
          canvasStates.value.front = data.canvasStates.front || null
          canvasStates.value.back = data.canvasStates.back || null
        }
        isFrontDirty.value = !!(canvasStates.value.front && canvasStates.value.front.objects && canvasStates.value.front.objects.length > 0)
        isBackDirty.value = !!(canvasStates.value.back && canvasStates.value.back.objects && canvasStates.value.back.objects.length > 0)
      } catch (e) {
        console.error('Gagal memulihkan auto-save:', e)
      }
    }
  }

  const resetStore = () => {
    currentView.value = 'front'
    shirtColor.value = '#ffffff'
    currentShirtType.value = 'tshirt'
    backdropType.value = 'solid'
    backdropColor.value = '#ffffff'
    customBackdropUrl.value = null
    canvasStates.value = {
      front: null,
      back: null
    }
    frontDesignUrl.value = null
    backDesignUrl.value = null
    isFrontDirty.value = false
    isBackDirty.value = false
    currentSize.value = 'L'
    uploadedImages.value = []
    localStorage.removeItem('kaostudio_autosave')
  }

  return {
    currentView,
    shirtColor,
    currentShirtType,
    canvasStates,
    frontDesignUrl,
    backDesignUrl,
    isFrontDirty,
    isBackDirty,
    currentSize,
    shirtSizes,
    backdropType,
    backdropColor,
    customBackdropUrl,
    uploadedImages,
    saveCanvasState,
    addUploadedImage,
    removeUploadedImage,
    saveToLocalStorage,
    loadFromLocalStorage,
    resetStore
  }
})
