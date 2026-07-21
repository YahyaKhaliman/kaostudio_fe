import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { 
  fetchProduk, 
  fetchWarnaTersedia, 
  fetchTarifJasa, 
  type ProductItem, 
  type WarnaTersediaResponse, 
  type TarifJasaItem 
} from '../services/api'
import { companyColors, presetColors, colorAliases } from '../utils/colors'

export type ViewType = 'front' | 'back' | 'both'
export type CanvasViewType = 'front' | 'back'
export type ShirtType = 'tshirt' | 'longTshirt' | 'polo'

// Helper generator ID acak sederhana menggunakan Math.random()
const generateUUID = (): string => {
  return Math.random().toString(36).slice(2, 11)
}

export const useConfiguratorStore = defineStore('configurator', () => {
  const currentView = ref<ViewType>('front')
  const shirtColor = ref<string>('#ffffff') // default white
  const currentShirtType = ref<ShirtType>('tshirt')
  
  // State API dinamis untuk produk, warna, dan tarif jasa
  const selectedFabric = ref<string>('COMBED 30S')
  const productsData = ref<Record<string, ProductItem[]>>({})
  const colorsData = ref<WarnaTersediaResponse>({})
  const tarifJasaData = ref<TarifJasaItem[]>([])
  const isApiLoading = ref<boolean>(false)

  // Getters computed untuk memproses warna & produk secara dinamis
  const activeColors = computed(() => {
    const fabric = selectedFabric.value;
    const model = currentShirtType.value;
    
    if (!colorsData.value || !colorsData.value[fabric] || !colorsData.value[fabric][model]) {
      return presetColors;
    }
    
    const colorNames = colorsData.value[fabric][model];
    
    // Map nama warna dari DB ke hex yang terdaftar di companyColors
    const mapped: { name: string; hex: string }[] = [];
    const unmatchedNames: string[] = [];

    colorNames.forEach(rawName => {
      // Coba cocokkan langsung dengan companyColors
      let matched = companyColors.find(c => c.name.toUpperCase() === rawName.toUpperCase());
      
      // Jika tidak ditemukan, cek alias (untuk ejaan DB yang berbeda)
      if (!matched) {
        const aliasName = colorAliases[rawName.toUpperCase()];
        if (aliasName) {
          matched = companyColors.find(c => c.name === aliasName);
        }
      }

      if (matched) {
        // Hindari duplikasi (misal NAVY/DONGKER dan NAVY merujuk ke warna sama)
        if (!mapped.some(m => m.hex === matched!.hex)) {
          mapped.push({
            name: matched.name,
            hex: matched.hex
          });
        }
      } else {
        unmatchedNames.push(rawName);
      }
    });

    if (unmatchedNames.length > 0) {
      console.warn(`[KaoStudio] Warna belum terdaftar di companyColors (${fabric}/${model}):`, unmatchedNames);
    }

    return mapped.length > 0 ? mapped : presetColors;
  });

  const activeProduct = computed(() => {
    const fabric = selectedFabric.value;
    const model = currentShirtType.value;
    
    let targetJenisKaos = "KO";
    let targetLengan = "PENDEK";
    
    if (model === "polo") {
      targetJenisKaos = "KK";
    } else if (model === "longTshirt") {
      targetLengan = "PANJANG";
    }
    
    const products = productsData.value[fabric] || [];
    
    // Temukan nama warna aktif
    const activeCols = activeColors.value;
    const matchedColor = activeCols.find(c => c.hex.toLowerCase() === shirtColor.value.toLowerCase());
    const activeColorName = matchedColor ? matchedColor.name : "";
    
    return products.find(p => {
      const isWarnaMatch = p.brg_warna.toUpperCase() === activeColorName.toUpperCase();
      const isModelMatch = p.brg_jeniskaos === targetJenisKaos && p.brg_lengan === targetLengan;
      return isWarnaMatch && isModelMatch;
    });
  });

  const loadInitialData = async () => {
    isApiLoading.value = true
    try {
      const [prod, colors, tarif] = await Promise.all([
        fetchProduk(),
        fetchWarnaTersedia(),
        fetchTarifJasa()
      ])
      productsData.value = prod.items
      colorsData.value = colors
      tarifJasaData.value = tarif
      
      // Setup nilai awal default jika data produk tersedia
      const fabrics = Object.keys(prod.items)
      if (fabrics.length > 0 && fabrics[0]) {
        selectedFabric.value = fabrics[0]
      }
    } catch (e) {
      console.error('Gagal memuat data referensi backend:', e)
    } finally {
      isApiLoading.value = false
    }
  }
  
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
    XS: { length: 65, width: 45 },
    S: { length: 67, width: 47 },
    M: { length: 69, width: 49 },
    L: { length: 71, width: 51 },
    XL: { length: 73, width: 53 },
    XXL: { length: 75, width: 55 },
    XXXL: { length: 77, width: 57 }
  }

  // Menyimpan kuantitas pilihan pesanan per ukuran (S, M, L, XL, XXL, XXXL)
  const orderQuantities = ref<Record<string, number>>({
    S: 0,
    M: 0,
    L: 0,
    XL: 0,
    XXL: 0,
    XXXL: 0,
  })

  // Menyimpan ukuran kaos aktif (S, M, L, XL, XXL, XXXL)
  const currentSize = ref<'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL'>('L')

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
    selectedFabric,
    productsData,
    colorsData,
    tarifJasaData,
    activeColors,
    activeProduct,
    isApiLoading,
    loadInitialData,
    canvasStates,
    frontDesignUrl,
    backDesignUrl,
    isFrontDirty,
    isBackDirty,
    currentSize,
    orderQuantities,
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
