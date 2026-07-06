import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ViewType = 'front' | 'back'

export const useConfiguratorStore = defineStore('configurator', () => {
  const currentView = ref<ViewType>('front')
  const shirtColor = ref<string>('#ffffff') // default white
  
  // Menyimpan state JSON Fabric.js untuk masing-masing view (depan & belakang)
  const canvasStates = ref<Record<ViewType, any>>({
    front: null,
    back: null
  })

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

  const setView = (view: ViewType) => {
    currentView.value = view
  }

  const setShirtColor = (color: string) => {
    shirtColor.value = color
  }

  const saveCanvasState = (view: ViewType, jsonState: any) => {
    canvasStates.value[view] = jsonState
  }

  const setBackdropType = (type: 'solid' | 'checkerboard' | 'gradient' | 'custom') => {
    backdropType.value = type
  }

  const setBackdropColor = (color: string) => {
    backdropColor.value = color
  }

  const setCustomBackdropUrl = (url: string | null) => {
    customBackdropUrl.value = url
  }

  const addUploadedImage = (name: string, dataUrl: string, size: number, originalSize: number) => {
    // Batasi kapasitas cache sementara maksimal 6 gambar kustom untuk mengamankan memori
    if (uploadedImages.value.length >= 6) {
      uploadedImages.value.shift()
    }
    uploadedImages.value.push({
      id: crypto.randomUUID(),
      name,
      dataUrl,
      size,
      originalSize
    })
  }

  const removeUploadedImage = (id: string) => {
    uploadedImages.value = uploadedImages.value.filter((img) => img.id !== id)
  }

  const resetStore = () => {
    currentView.value = 'front'
    shirtColor.value = '#ffffff'
    backdropType.value = 'solid'
    backdropColor.value = '#ffffff'
    customBackdropUrl.value = null
    canvasStates.value = {
      front: null,
      back: null
    }
    uploadedImages.value = []
  }

  return {
    currentView,
    shirtColor,
    canvasStates,
    backdropType,
    backdropColor,
    customBackdropUrl,
    uploadedImages,
    setView,
    setShirtColor,
    saveCanvasState,
    setBackdropType,
    setBackdropColor,
    setCustomBackdropUrl,
    addUploadedImage,
    removeUploadedImage,
    resetStore
  }
})
