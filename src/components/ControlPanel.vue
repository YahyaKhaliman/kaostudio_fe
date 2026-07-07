<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useConfiguratorStore } from '../stores/configurator'
import { 
  PhTShirt, 
  PhTextT, 
  PhUploadSimple, 
  PhPalette, 
  PhImage, 
  PhSparkle, 
  PhGridFour, 
  PhTrash, 
  PhArrowUp, 
  PhArrowDown, 
  PhDownloadSimple,
  PhPaintBrush,
  PhFloppyDisk,
  PhPlus
} from '@phosphor-icons/vue'

import { compressImage, formatBytes } from '../utils/imageCompressor'

const props = defineProps<{
  selectedObject: any
}>()

const emit = defineEmits<{
  (e: 'add-text', text: string, color: string, font: string): void
  (e: 'add-image', file: File | string): void
  (e: 'delete-selected'): void
  (e: 'bring-to-front'): void
  (e: 'send-to-back'): void
  (e: 'export-mockup'): void
  (e: 'export-print'): void
  (e: 'update-text', text: string): void
  (e: 'update-color', color: string): void
  (e: 'update-font', font: string): void
  (e: 'update-font-size', size: number): void
  (e: 'deselect-object'): void
}>()

const store = useConfiguratorStore()

// Template Ref
const fileInput = ref<HTMLInputElement | null>(null)
const triggerFileInput = () => {
  fileInput.value?.click()
}

// State Input
const textInput = ref('')
const textColor = ref('#7c3aed') // default violet
const textFont = ref('Inter')
const fontSize = ref(24)
const uploadError = ref('')

// Preset warna kaos
const presetColors = [
  { name: 'Putih', hex: '#ffffff' },
  { name: 'Hitam', hex: '#111827' },
  { name: 'Abu-abu', hex: '#6b7280' },
  { name: 'Biru Navy', hex: '#1e3a8a' },
  { name: 'Merah', hex: '#b91c1c' },
  { name: 'Hijau Botol', hex: '#064e3b' },
  { name: 'Kuning', hex: '#f59e0b' }
]

// Daftar Font Google
const fontList = ['Inter', 'Montserrat', 'Playfair Display', 'Poppins', 'Oswald']

// Mendeteksi apakah objek yang dipilih adalah teks
const isTextSelected = computed(() => {
  return props.selectedObject && ['i-text', 'text', 'textbox'].includes(props.selectedObject.type)
})

// Mendeteksi apakah warna kaos saat ini adalah warna kustom (di luar preset)
const isCustomColorSelected = computed(() => {
  return !presetColors.some(c => c.hex.toLowerCase() === store.shirtColor.toLowerCase())
})

// Sinkronisasi input form saat objek teks di kanvas dipilih
watch(
  () => props.selectedObject,
  (newObj) => {
    if (newObj && ['i-text', 'text', 'textbox'].includes(newObj.type)) {
      textInput.value = newObj.text || ''
      textColor.value = newObj.fill || '#000000'
      textFont.value = newObj.fontFamily || 'Inter'
      fontSize.value = newObj.fontSize || 24
    } else if (!newObj) {
      textInput.value = ''
    }
  },
  { deep: true }
)

// Pemicu pembaruan saat pengguna mengubah input ketika objek teks sedang aktif
const handleTextChange = () => {
  if (isTextSelected.value) {
    emit('update-text', textInput.value)
  }
}

const handleColorChange = () => {
  if (isTextSelected.value) {
    emit('update-color', textColor.value)
  }
}

const handleFontChange = () => {
  if (isTextSelected.value) {
    emit('update-font', textFont.value)
  }
}

const handleFontSizeChange = () => {
  if (isTextSelected.value) {
    emit('update-font-size', fontSize.value)
  }
}

// Menambahkan teks baru
const handleAddText = () => {
  if (!textInput.value.trim()) return
  emit('add-text', textInput.value, textColor.value, textFont.value)
  if (!isTextSelected.value) {
    textInput.value = '' // reset input jika menambahkan teks baru
  }
}

// Proses kompresi dan simpan gambar
const processAndUploadImage = async (file: File) => {
  uploadError.value = ''
  
  // Pengaman: Batasi ukuran file mentah maksimal 10MB
  const maxSizeBytes = 10 * 1024 * 1024
  if (file.size > maxSizeBytes) {
    uploadError.value = `Ukuran file terlalu besar (${formatBytes(file.size)}). Maksimal berkas adalah 10MB.`
    return
  }

  try {
    // Kompresi gambar di sisi klien ke dimensi maks 1000px dengan kualitas 80%
    const compressed = await compressImage(file, 1000, 0.8)
    
    // Simpan ke storage store sementara
    store.addUploadedImage(file.name, compressed.dataUrl, compressed.compressedSize, file.size)
    
    // Emit dataURL gambar terkompresi langsung ke canvas
    emit('add-image', compressed.dataUrl)
  } catch (err: any) {
    uploadError.value = err.message || 'Gagal memproses dan mengompres gambar.'
    console.error(err)
  }
}

// Menangani unggah gambar kustom
const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    processAndUploadImage(target.files[0])
    target.value = '' // Reset input file
  }
}

// Template Ref & Handler untuk Latar Belakang Kustom
const backdropFileInput = ref<HTMLInputElement | null>(null)
const triggerBackdropFileInput = () => {
  backdropFileInput.value?.click()
}
const handleBackdropUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    const reader = new FileReader()
    reader.onload = (e) => {
      const url = e.target?.result as string
      store.customBackdropUrl = url
      store.backdropType = 'custom'
    }
    reader.readAsDataURL(file)
  }
}

// Menangani drag and drop gambar
const isDragActive = ref(false)
const onDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragActive.value = true
}
const onDragLeave = () => {
  isDragActive.value = false
}
const onDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragActive.value = false
  if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
    const file = e.dataTransfer.files[0]
    if (file.type.startsWith('image/')) {
      processAndUploadImage(file)
    }
  }
}
</script>

<template>
  <div class="bg-white/95 border border-sky-100 rounded-3xl p-6 shadow-xl space-y-6 text-slate-800 backdrop-blur-md relative overflow-hidden">
    <!-- Top thin glow decoration -->
    <div class="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-sky-400/50 to-transparent"></div>

    <!-- BAGIAN 1: Model & Sisi Pakaian -->
    <div class="space-y-4">
      <h3 class="text-xs font-black uppercase tracking-wider text-sky-800 flex items-center gap-2">
        <PhTShirt :size="16" weight="bold" />
        <span>1. Konfigurasi Kaos</span>
      </h3>
      
      <!-- Sisi Kaos Toggle -->
      <div>
        <label class="block text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wide">Pilih Tampilan Sisi:</label>
        <div class="grid grid-cols-2 gap-1 bg-slate-50 p-1 rounded-xl border border-sky-100">
          <button
            @click="store.currentView = 'front'"
            :class="[
              'py-2 px-3 text-xs font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2',
              store.currentView === 'front'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20 border border-sky-500/10'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
            ]"
          >
            Tampak Depan
          </button>
          <button
            @click="store.currentView = 'back'"
            :class="[
              'py-2 px-3 text-xs font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2',
              store.currentView === 'back'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20 border border-sky-500/10'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
            ]"
          >
            Tampak Belakang
          </button>
        </div>
      </div>

      <!-- Pilihan Warna Kaos -->
      <div>
        <label class="block text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wide">Pilih Warna Kaos:</label>
        <div class="flex flex-wrap gap-2.5 items-center">
          <button
            v-for="color in presetColors"
            :key="color.hex"
            @click="store.shirtColor = color.hex"
            :title="color.name"
            :class="[
              'w-8 h-8 rounded-full border border-slate-200 transition-all duration-300 relative hover:scale-115 focus:outline-none flex items-center justify-center',
              store.shirtColor.toLowerCase() === color.hex.toLowerCase()
                ? 'ring-2 ring-sky-500 ring-offset-2 ring-offset-white scale-105 shadow-[0_0_15px_rgba(14,165,233,0.3)]'
                : 'hover:border-slate-350'
            ]"
            :style="{ backgroundColor: color.hex }"
          >
            <!-- Checkmark untuk warna terpilih -->
            <span
              v-if="store.shirtColor.toLowerCase() === color.hex.toLowerCase()"
              :class="[
                'text-[10px] font-black',
                color.hex === '#ffffff' ? 'text-slate-900' : 'text-white'
              ]"
            >
              ✓
            </span>
          </button>
          
          <!-- Custom Color Picker (Dinamis & Konsisten Tema Sky) -->
          <div 
            class="relative w-8 h-8 rounded-full border border-dashed border-slate-300 overflow-hidden flex items-center justify-center bg-slate-50 hover:border-sky-500/60 hover:scale-105 active:scale-95 transition-all"
            :style="{ backgroundColor: isCustomColorSelected ? store.shirtColor : 'transparent' }"
            :class="{ 'ring-2 ring-sky-500 ring-offset-2 ring-offset-white scale-105 shadow-[0_0_15px_rgba(14,165,233,0.35)] border-solid border-sky-500/20': isCustomColorSelected }"
          >
            <input
              type="color"
              :value="store.shirtColor"
              @input="(e) => store.shirtColor = (e.target as HTMLInputElement).value"
              class="absolute w-[150%] h-[150%] cursor-pointer border-0 p-0 bg-transparent"
              title="Custom Color"
            />
            <PhPlus 
              class="pointer-events-none" 
              :class="isCustomColorSelected && store.shirtColor === '#ffffff' ? 'text-slate-900' : 'text-slate-500'"
              :size="12" 
              weight="bold" 
            />
          </div>
        </div>
      </div>
    </div>

    <hr class="border-sky-100/50" />

    <!-- BAGIAN 2: Tambahkan / Edit Teks -->
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="text-xs font-black uppercase tracking-wider text-sky-800 flex items-center gap-2">
          <PhTextT :size="16" weight="bold" />
          <span>{{ isTextSelected ? '2. Edit Teks Aktif' : '2. Tambahkan Teks' }}</span>
        </h3>
        <span v-if="isTextSelected" class="text-[9px] bg-sky-100 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-md font-bold tracking-wide">Teks Dipilih</span>
      </div>

      <!-- Input Text -->
      <div class="space-y-1.5">
        <div class="relative">
          <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <PhTextT :size="16" weight="bold" />
          </span>
          <input
            type="text"
            v-model="textInput"
            @input="handleTextChange"
            placeholder="Tulis teks desain Anda..."
            class="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all duration-200"
          />
        </div>
      </div>

      <!-- Kontrol Styling Teks (Muncul jika ada teks dipilih ATAU sedang ingin menambahkan teks baru) -->
      <div class="grid grid-cols-2 gap-3">
        <!-- Pilihan Font -->
        <div class="space-y-1.5">
          <label class="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Jenis Font:</label>
          <div class="relative">
            <select
              v-model="textFont"
              @change="handleFontChange"
              class="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-sky-500 focus:bg-white text-slate-800 transition-all duration-200 cursor-pointer appearance-none"
            >
              <option 
                v-for="font in fontList" 
                :key="font" 
                :value="font"
                :style="{ fontFamily: font }"
                class="bg-white text-slate-800 text-sm py-1.5"
              >
                {{ font }}
              </option>
            </select>
            <span class="absolute right-3 inset-y-0 flex items-center pointer-events-none text-slate-400 text-[10px]">▼</span>
          </div>
        </div>

        <!-- Warna Teks -->
        <div class="space-y-1.5">
          <label class="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Warna Sablon:</label>
          <div class="flex gap-2.5 items-center">
            <div class="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center hover:border-sky-500/50 transition-colors">
              <input
                type="color"
                v-model="textColor"
                @input="handleColorChange"
                class="absolute w-[150%] h-[150%] cursor-pointer border-0 p-0 bg-transparent"
              />
            </div>
            <span class="text-xs uppercase text-slate-700 font-mono font-bold select-all tracking-wider">{{ textColor }}</span>
          </div>
        </div>
      </div>

      <!-- Ukuran Font Slider (Hanya aktif jika teks dipilih untuk diedit) -->
      <div v-if="isTextSelected" class="space-y-1.5 pt-1.5">
        <div class="flex justify-between text-[10px] uppercase font-bold text-slate-500 tracking-wide">
          <span>Ukuran Teks:</span>
          <span class="font-mono text-sky-600 font-bold">{{ fontSize }}px</span>
        </div>
        <input
          type="range"
          v-model.number="fontSize"
          @input="handleFontSizeChange"
          min="12"
          max="120"
          step="1"
          class="w-full accent-sky-600 bg-slate-200 h-1.5 rounded-lg cursor-pointer transition-all"
        />
      </div>

      <!-- Tombol Buat Teks Baru (Selalu Tampil dengan Tombol Batal untuk Kemudahan Akses) -->
      <div class="flex gap-2">
        <button
          @click="handleAddText"
          :disabled="!textInput.trim()"
          class="flex-grow py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 border border-sky-500/10 shadow-md active:scale-[0.98]"
        >
          <PhPlus :size="14" weight="bold" />
          <span>{{ isTextSelected ? 'Duplikat Baru' : 'Tambahkan Teks' }}</span>
        </button>
        <button
          v-if="isTextSelected"
          @click="emit('deselect-object')"
          class="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-800 border border-slate-200 transition-all font-bold text-xs shadow-sm hover:scale-102 active:scale-98"
          title="Batal Pilih / Selesai Edit"
        >
          Batal
        </button>
      </div>
    </div>

    <hr class="border-sky-100/50" />

    <!-- BAGIAN 3: Unggah Desain / Logo -->
    <div class="space-y-4">
      <h3 class="text-xs font-black uppercase tracking-wider text-sky-800 flex items-center gap-2">
        <PhUploadSimple :size="16" weight="bold" />
        <span>3. Unggah Logo / Gambar</span>
      </h3>
      
      <div
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
        :class="[
          'border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 bg-slate-50/60 relative group',
          isDragActive 
            ? 'border-sky-500 bg-sky-50 shadow-[0_0_20px_rgba(14,165,233,0.15)]' 
            : 'border-sky-200 hover:border-sky-400 hover:bg-sky-50/50'
        ]"
        @click="triggerFileInput"
      >
        <input
          type="file"
          ref="fileInput"
          @change="handleFileUpload"
          accept="image/*"
          class="hidden"
        />
        <!-- Upload Icon (Micro-animated) -->
        <PhUploadSimple 
          class="h-8 w-8 text-slate-400 group-hover:text-sky-500 transition-colors duration-300 mb-2 group-hover:animate-bounce" 
          :size="32" 
          weight="bold" 
        />
        <span class="text-xs font-bold text-slate-700 text-center">Klik atau seret logo ke sini</span>
        <span class="text-[10px] text-slate-400 mt-1">PNG, JPG, SVG maks 10MB</span>
      </div>

      <!-- Pesan Error Pengaman -->
      <div 
        v-if="uploadError" 
        class="text-[10px] font-semibold text-red-500 bg-red-50 border border-red-200 py-2 px-3 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
        {{ uploadError }}
      </div>

      <!-- Galeri Gambar Saya (storage sementara) -->
      <div v-if="store.uploadedImages.length > 0" class="space-y-2.5 pt-1">
        <label class="block text-[10px] uppercase font-black text-slate-500 tracking-wider">Galeri Cache Sementara:</label>
        <div class="grid grid-cols-3 gap-2">
          <div 
            v-for="img in store.uploadedImages" 
            :key="img.id"
            class="relative group/thumb border border-slate-200 rounded-xl overflow-hidden bg-slate-50 h-16 cursor-pointer hover:border-sky-500/60 hover:shadow-lg hover:shadow-sky-500/5 transition-all duration-300 flex items-center justify-center"
            @click="emit('add-image', img.dataUrl)"
            :title="`Klik untuk menambahkan. Ukuran: ${formatBytes(img.size)} (Kompresi dari ${formatBytes(img.originalSize)})`"
          >
            <img :src="img.dataUrl" class="w-full h-full object-contain p-2" />
            
            <!-- Overlay Hover Info -->
            <div class="absolute inset-0 bg-sky-950/80 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-300 flex flex-col justify-center items-center text-[8px] text-sky-100 p-0.5 text-center">
              <span class="font-black text-sky-300 tracking-wider">KOMPRES</span>
              <span class="font-bold font-mono mt-0.5">{{ formatBytes(img.size) }}</span>
            </div>

            <!-- Delete Button -->
            <button 
              @click.stop="store.removeUploadedImage(img.id)"
              class="absolute top-1 right-1 bg-red-50 border border-red-200 p-1 rounded-lg text-red-600 hover:bg-red-100 transition-all opacity-0 group-hover/thumb:opacity-100 z-10"
              title="Hapus dari cache"
            >
              <PhTrash :size="10" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <hr class="border-sky-100/50" />

    <!-- BAGIAN 4: Latar Belakang Mockup -->
    <div class="space-y-4">
      <h3 class="text-xs font-black uppercase tracking-wider text-sky-800 flex items-center gap-2">
        <PhPalette :size="16" weight="bold" />
        <span>4. Latar Belakang Mockup</span>
      </h3>
      
      <!-- Pilihan Jenis Latar Belakang -->
      <div>
        <div class="grid grid-cols-4 gap-1 bg-slate-50 p-1 rounded-xl border border-sky-100">
          <button
            v-for="type in (['solid', 'checkerboard', 'gradient', 'custom'] as const)"
            :key="type"
            @click="store.backdropType = type"
            :class="[
              'py-2 px-1 text-[9px] font-black rounded-lg capitalize transition-all duration-300 flex flex-col items-center justify-center gap-1',
              store.backdropType === type
                ? 'bg-sky-600 text-white shadow shadow-sky-500/15 border border-sky-500/10'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/30'
            ]"
          >
            <!-- Ikon Mini representatif -->
            <PhPaintBrush v-if="type === 'solid'" :size="14" weight="bold" />
            <PhGridFour v-else-if="type === 'checkerboard'" :size="14" weight="bold" />
            <PhSparkle v-else-if="type === 'gradient'" :size="14" weight="bold" />
            <PhImage v-else-if="type === 'custom'" :size="14" weight="bold" />
            
            <span>{{ type === 'solid' ? 'Warna' : type === 'checkerboard' ? 'Catur' : type === 'gradient' ? 'Studio' : 'Foto' }}</span>
          </button>
        </div>
      </div>

      <!-- Detail Kustomisasi Solid Color -->
      <div v-if="store.backdropType === 'solid'" class="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-sky-100 transition-all">
        <span class="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Warna Latar:</span>
        <div class="flex gap-3 items-center">
          <div class="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center hover:border-sky-500/50 transition-colors">
            <input
              type="color"
              :value="store.backdropColor"
              @input="(e) => store.backdropColor = (e.target as HTMLInputElement).value"
              class="absolute w-[150%] h-[150%] cursor-pointer border-0 p-0 bg-transparent"
            />
          </div>
          <span class="text-xs font-mono uppercase text-slate-700 font-bold tracking-wider">{{ store.backdropColor }}</span>
          <button
            @click="store.backdropColor = '#0f172a'"
            class="text-[9px] font-bold uppercase tracking-wider py-1.5 px-3 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      <!-- Detail Kustomisasi Custom Backdrop Image -->
      <div v-if="store.backdropType === 'custom'" class="space-y-3 transition-all">
        <div 
          @click="triggerBackdropFileInput"
          class="border border-dashed border-sky-200 hover:border-sky-300 hover:bg-sky-50 bg-slate-50 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors group"
        >
          <input
            type="file"
            ref="backdropFileInput"
            @change="handleBackdropUpload"
            accept="image/*"
            class="hidden"
          />
          <PhImage class="text-slate-400 group-hover:text-sky-500 transition-colors mb-1.5" :size="20" weight="bold" />
          <span class="text-[10px] font-bold text-slate-700">Pilih Foto Latar Belakang</span>
          <span class="text-[8px] text-slate-400 mt-0.5">Lantai kayu, hanger, atau foto studio</span>
        </div>
        <!-- Preview Custom Image -->
        <div v-if="store.customBackdropUrl" class="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-sky-100">
          <div class="flex items-center gap-2.5">
            <img :src="store.customBackdropUrl" class="w-8 h-8 object-cover rounded-lg border border-slate-200" />
            <span class="text-[10px] font-bold text-slate-500">Gambar terpasang</span>
          </div>
          <button
            @click="store.customBackdropUrl = null"
            class="text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all"
          >
            Hapus
          </button>
        </div>
      </div>
    </div>

    <!-- BAGIAN 4: Pengaturan Objek Layer / Hapus (Hanya muncul jika ada objek dipilih) -->
    <div v-if="selectedObject" class="space-y-3.5 p-4.5 bg-sky-50/70 border border-sky-200/50 rounded-2xl transition-all duration-300 relative overflow-hidden shadow-sm">
      <!-- Glow strip -->
      <div class="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-sky-500 to-indigo-500"></div>
      
      <h4 class="text-[10px] font-black uppercase tracking-widest text-sky-850 pl-1">Pengaturan Objek Terpilih</h4>
      <div class="grid grid-cols-3 gap-2">
        <button
          @click="emit('bring-to-front')"
          class="py-2 px-2.5 text-[9px] font-bold uppercase tracking-wider bg-white border border-sky-200 hover:border-sky-300 rounded-xl text-slate-700 hover:text-sky-950 transition-all flex items-center justify-center gap-1 hover:scale-102 active:scale-98 shadow-sm"
        >
          <PhArrowUp :size="12" weight="bold" />
          <span>Ke Depan</span>
        </button>
        <button
          @click="emit('send-to-back')"
          class="py-2 px-2.5 text-[9px] font-bold uppercase tracking-wider bg-white border border-sky-200 hover:border-sky-300 rounded-xl text-slate-700 hover:text-sky-950 transition-all flex items-center justify-center gap-1 hover:scale-102 active:scale-98 shadow-sm"
        >
          <PhArrowDown :size="12" weight="bold" />
          <span>Ke Belakang</span>
        </button>
        <button
          @click="emit('delete-selected')"
          class="py-2 px-2.5 text-[9px] font-bold uppercase tracking-wider bg-red-50 border border-red-200 hover:bg-red-100 hover:text-red-700 rounded-xl text-red-600 transition-all flex items-center justify-center gap-1 hover:scale-102 active:scale-98"
        >
          <PhTrash :size="12" weight="bold" />
          <span>Hapus</span>
        </button>
      </div>
    </div>

    <hr class="border-sky-100/50" />

    <!-- BAGIAN 5: Ekspor Produksi & Mockup -->
    <div class="space-y-4 pt-1">
      <h3 class="text-xs font-black uppercase tracking-wider text-sky-800 flex items-center gap-2">
        <PhDownloadSimple :size="16" weight="bold" />
        <span>5. Ekspor Hasil Desain</span>
      </h3>
      <div class="grid grid-cols-2 gap-3.5">
        <button
          @click="emit('export-print')"
          class="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 font-bold text-xs transition-all duration-300 flex flex-col items-center justify-center gap-1.5 border border-slate-200 hover:border-slate-300 shadow-sm active:scale-[0.98] group"
        >
          <PhFloppyDisk class="text-slate-500 group-hover:text-slate-700 transition-colors" :size="20" weight="bold" />
          <div class="flex flex-col items-center">
            <span>Unduh Sablon</span>
            <span class="text-[8px] text-slate-500 font-medium mt-0.5">Desain DTF/DTG (PNG)</span>
          </div>
        </button>
        <button
          @click="emit('export-mockup')"
          class="py-3 px-4 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all duration-300 flex flex-col items-center justify-center gap-1.5 border border-sky-500/10 shadow-md shadow-sky-500/15 active:scale-[0.98] group"
        >
          <PhImage class="text-sky-100 group-hover:text-white transition-colors" :size="20" weight="bold" />
          <div class="flex flex-col items-center">
            <span>Unduh Mockup</span>
            <span class="text-[8px] text-sky-100 font-medium mt-0.5">Preview Pelanggan (JPG)</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Transisi halus slider */
input[type="range"]::-webkit-slider-thumb {
  box-shadow: 0 0 10px rgba(14, 165, 233, 0.4);
  border: 1.5px solid rgba(255, 255, 255, 0.8);
}
</style>
