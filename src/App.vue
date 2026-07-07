<script setup lang="ts">
import { ref } from 'vue'
import ConfiguratorCanvas from './components/ConfiguratorCanvas.vue'
import ControlPanel from './components/ControlPanel.vue'
import { PhTShirt, PhBookOpen } from '@phosphor-icons/vue'

const canvasRef = ref<InstanceType<typeof ConfiguratorCanvas> | null>(null)

// Menghubungkan event callback manipulasi objek ke Canvas
const handleAddText = (text: string, color: string, font: string) => {
  canvasRef.value?.addText(text, color, font)
}

const handleAddImage = (file: File | string) => {
  canvasRef.value?.addImage(file)
}

const handleDeleteSelected = () => {
  canvasRef.value?.deleteSelected()
}

const handleBringToFront = () => {
  canvasRef.value?.bringToFront()
}

const handleSendToBack = () => {
  canvasRef.value?.sendToBack()
}

const handleUpdateText = (text: string) => {
  canvasRef.value?.updateSelectedText(text)
}

const handleUpdateColor = (color: string) => {
  canvasRef.value?.updateSelectedColor(color)
}

const handleUpdateFont = (font: string) => {
  canvasRef.value?.updateSelectedFont(font)
}

const handleUpdateFontSize = (size: number) => {
  canvasRef.value?.updateSelectedFontSize(size)
}

// Menangani ekspor gambar mockup lengkap
const handleExportMockup = async () => {
  if (!canvasRef.value) return
  try {
    const dataUrl = await canvasRef.value.exportMockup()
    if (!dataUrl) return
    
    const link = document.createElement('a')
    link.download = `mockup-kaos-${Date.now()}.jpg`
    link.href = dataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Gagal mengekspor mockup:', error)
  }
}

// Menangani ekspor desain sablon saja (transparan)
const handleExportPrint = () => {
  if (!canvasRef.value) return
  try {
    const dataUrl = canvasRef.value.exportPrint()
    if (!dataUrl) return
    
    const link = document.createElement('a')
    link.download = `desain-sablon-${Date.now()}.png`
    link.href = dataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Gagal mengekspor desain cetak:', error)
  }
}

// Menangani deselect objek aktif
const handleDeselectObject = () => {
  canvasRef.value?.deselectObject()
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-sky-200 via-sky-500 to-sky-700 text-slate-800 flex flex-col font-sans relative overflow-hidden selection:bg-sky-500/30 selection:text-sky-900">
    <!-- Ambient Light Highlights (Studio brightness) -->
    <div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-white/20 blur-[120px] pointer-events-none"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-white/10 blur-[150px] pointer-events-none"></div>

    <!-- Navbar / Header -->
    <header class="bg-white/85 border-b border-sky-100 px-6 py-4 flex items-center justify-between shadow-md backdrop-blur-md sticky top-0 z-50">
      <div class="flex items-center space-x-3.5">
        <!-- Logo Vektor Premium -->
        <div class="bg-gradient-to-tr from-sky-600 to-indigo-600 p-2.5 rounded-xl text-white font-black text-xl tracking-wider shadow-md shadow-sky-900/20 border border-sky-500/10 flex items-center justify-center">
          <PhTShirt :size="24" weight="bold" />
        </div>
        <div>
          <h1 class="text-lg font-extrabold tracking-tight text-sky-950">
            KaoStudio
          </h1>
          <p class="text-[10px] text-slate-500 font-medium tracking-wide">Premium Clothing Mockup & Sablon Editor</p>
        </div>
      </div>
      
      <div>
        <a 
          href="https://github.com" 
          target="_blank" 
          class="text-xs text-sky-800 hover:text-sky-950 transition-all duration-200 py-2 px-4 rounded-xl border border-sky-200 hover:border-sky-300 bg-sky-50/80 hover:bg-sky-100/90 flex items-center gap-2 shadow-sm"
        >
          <PhBookOpen :size="15" weight="bold" />
          <span>Dokumentasi</span>
        </a>
      </div>
    </header>

    <!-- Main Workspace Area -->
    <main class="flex-grow max-w-7xl mx-auto w-full p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
      <!-- Sisi Kiri: Canvas Preview (Col 1-7) -->
      <div class="lg:col-span-7 flex flex-col items-center justify-center bg-white/95 border border-sky-100/50 rounded-3xl p-6 shadow-xl backdrop-blur-md min-h-[550px] relative overflow-hidden group">
        <!-- Top border glow highlight -->
        <div class="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-sky-400/40 to-transparent"></div>
        
        <h2 class="text-xs font-bold text-slate-500 mb-6 tracking-widest uppercase flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
          Workspace Studio
        </h2>
        <ConfiguratorCanvas ref="canvasRef" />
      </div>

      <!-- Sisi Kanan: Panel Kontrol (Col 8-12) -->
      <div class="lg:col-span-5 relative">
        <ControlPanel
          :selected-object="canvasRef?.selectedObject"
          @add-text="handleAddText"
          @add-image="handleAddImage"
          @delete-selected="handleDeleteSelected"
          @bring-to-front="handleBringToFront"
          @send-to-back="handleSendToBack"
          @export-mockup="handleExportMockup"
          @export-print="handleExportPrint"
          @update-text="handleUpdateText"
          @update-color="handleUpdateColor"
          @update-font="handleUpdateFont"
          @update-font-size="handleUpdateFontSize"
          @deselect-object="handleDeselectObject"
        />
      </div>
    </main>

    <!-- Footer -->
    <footer class="bg-sky-950 py-5 px-6 text-center text-xs text-sky-300 relative z-10">
      <p class="font-medium tracking-wide">
        &copy; 2026 <span class="text-white font-bold">KaoStudio</span>. Dibuat dengan Vue 3, Pinia, Tailwind CSS & Fabric.js.
      </p>
    </footer>
  </div>
</template>

<style>
body {
  overflow-x: hidden;
  background-color: #0369a1; /* Sesuai bottom gradasi sky-700 */
}

/* Custom scrollbar to match Light Sky Theme */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: #0284c7;
}
::-webkit-scrollbar-thumb {
  background: #bae6fd;
  border-radius: 9999px;
  border: 2px solid #0284c7;
}
::-webkit-scrollbar-thumb:hover {
  background: #e0f2fe;
}
</style>
