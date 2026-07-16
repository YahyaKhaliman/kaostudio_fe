<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import ConfiguratorCanvas from "./components/configuratorCanvas.vue";
import ControlPanel from "./components/controlPanel.vue";
import {
    PhTShirt,
    PhQuestion,
    PhX,
    PhSun,
    PhMoon,
    PhCalculator,
    PhCheck,
} from "@phosphor-icons/vue";
import { useConfiguratorStore } from "./stores/configurator";
import packageJson from "../package.json";
import EstimasiHargaModal from "./components/estimasiHarga.vue";

const appVersion = packageJson.version;
const showGuide = ref(false);
const store = useConfiguratorStore();
const showPricingEstimation = ref(false);

const isDarkMode = ref(false);

const toggleDarkMode = () => {
    isDarkMode.value = !isDarkMode.value;
    updateDarkClass();
};

const updateDarkClass = () => {
    if (isDarkMode.value) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("kaostudio_darkmode", "true");
    } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("kaostudio_darkmode", "false");
    }
};

const canvasRef = ref<InstanceType<typeof ConfiguratorCanvas> | null>(null);

// Mencegah refresh halaman secara tidak sengaja jika terdapat perubahan desain aktif
const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (store.isFrontDirty || store.isBackDirty) {
        e.preventDefault();
        e.returnValue = ""; // Mengaktifkan dialog konfirmasi standar di sebagian besar browser modern
        return "";
    }
};

onMounted(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Muat preferensi mode gelap
    const savedDark = localStorage.getItem("kaostudio_darkmode");
    if (savedDark === "true") {
        isDarkMode.value = true;
    } else if (!savedDark) {
        // Fallback ke preferensi sistem OS
        isDarkMode.value = window.matchMedia(
            "(prefers-color-scheme: dark)",
        ).matches;
    }
    updateDarkClass();
});

onUnmounted(() => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
});

// Menghubungkan event callback manipulasi objek ke Canvas
const handleAddText = (text: string, color: string, font: string) => {
    canvasRef.value?.addText(text, color, font);
};

const handleAddImage = (file: File | string) => {
    canvasRef.value?.addImage(file);
};

const handleDeleteSelected = () => {
    canvasRef.value?.deleteSelected();
};

const handleBringToFront = () => {
    canvasRef.value?.bringToFront();
};

const handleSendToBack = () => {
    canvasRef.value?.sendToBack();
};

const handleUpdateText = (text: string) => {
    canvasRef.value?.updateSelectedText(text);
};

const handleUpdateColor = (color: string) => {
    canvasRef.value?.updateSelectedColor(color);
};

const handleUpdateFont = (font: string) => {
    canvasRef.value?.updateSelectedFont(font);
};

const handleUpdateFontSize = (size: number) => {
    canvasRef.value?.updateSelectedFontSize(size);
};

const handleUpdateImageSize = (widthCm: number, heightCm: number) => {
    canvasRef.value?.updateSelectedImageSize(widthCm, heightCm);
};

// Menangani ekspor gambar mockup lengkap
const handleExportMockup = async (view: "front" | "back" | "both") => {
    if (!canvasRef.value) return;
    try {
        const files = await canvasRef.value.exportMockup(view);
        files.forEach((file) => {
            const link = document.createElement("a");
            link.download = file.name;
            link.href = file.dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    } catch (error) {
        console.error("Gagal mengekspor mockup:", error);
    }
};

// Menangani ekspor desain sablon saja (transparan)
const handleExportPrint = async (view: "front" | "back" | "both") => {
    if (!canvasRef.value) return;
    try {
        const files = await canvasRef.value.exportPrint(view);
        files.forEach((file) => {
            const link = document.createElement("a");
            link.download = file.name;
            link.href = file.dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    } catch (error) {
        console.error("Gagal mengekspor desain cetak:", error);
    }
};

// Menangani deselect objek aktif
const handleDeselectObject = () => {
    canvasRef.value?.deselectObject();
};

const handleCropSelectedImage = (croppedDataUrl: string) => {
    canvasRef.value?.cropSelectedImage(croppedDataUrl);
};

const handleUpdateRotation = (angle: number) => {
    canvasRef.value?.updateSelectedRotation(angle);
};
</script>

<template>
    <div
        class="min-h-screen bg-gradient-to-b from-sky-200 via-sky-500 to-sky-700 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 text-slate-800 dark:text-slate-100 flex flex-col font-sans relative overflow-hidden selection:bg-sky-500/30 selection:text-sky-900 dark:selection:bg-sky-500/20 dark:selection:text-sky-300 transition-colors duration-300"
    >
        <!-- Ambient Light Highlights (Studio brightness) -->
        <div
            class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-white/20 dark:bg-sky-500/10 blur-[120px] pointer-events-none"
        ></div>
        <div
            class="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-white/10 dark:bg-indigo-500/10 blur-[150px] pointer-events-none"
        ></div>

        <!-- Navbar / Header -->
        <header
            class="bg-white/85 dark:bg-slate-900/85 border border-sky-100/50 dark:border-slate-800/80 px-6 py-3.5 flex items-center justify-between shadow-lg dark:shadow-slate-950/30 backdrop-blur-md sticky top-4 z-50 max-w-7xl mx-auto w-[calc(100%-2rem)] rounded-2xl transition-all duration-300"
        >
            <div class="flex items-center space-x-3.5">
                <!-- Logo Gambar Kaosan -->
                <img
                    src="/kaosan.png"
                    alt="Logo Kaosan"
                    class="w-10 h-10 object-contain rounded-xl shadow-md border border-sky-100/30 dark:border-slate-800 bg-white/5"
                />
                <div>
                    <h1
                        class="text-lg font-extrabold tracking-tight text-sky-950 dark:text-white"
                    >
                        KaoStudio
                    </h1>
                    <p
                        class="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide"
                    >
                        Premium Clothing Mockup & Sablon Editor
                    </p>
                </div>
            </div>

            <div class="flex items-center space-x-2">
                <!-- Tombol Estimasi Harga -->
                <button
                    @click="showPricingEstimation = true"
                    class="text-sky-800 dark:text-sky-200 hover:text-sky-950 dark:hover:text-white px-4 h-10 rounded-xl border border-sky-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-slate-650 bg-sky-50/85 dark:bg-slate-800/80 hover:bg-sky-100/95 dark:hover:bg-slate-750/90 flex items-center justify-center gap-1.5 shadow-sm active:scale-100 cursor-pointer font-bold text-xs transition-all"
                    title="Lihat Estimasi Harga Produksi"
                >
                    <PhCalculator :size="16" weight="bold" />
                    <span>Estimasi Harga</span>
                </button>

                <!-- Tombol Mode Gelap -->
                <button
                    @click="toggleDarkMode"
                    class="text-sky-800 hover:text-sky-950 dark:text-sky-200 dark:hover:text-white transition-all duration-250 w-10 h-10 rounded-xl border border-sky-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-slate-650 bg-sky-50/85 dark:bg-slate-800/80 hover:bg-sky-100/95 dark:hover:bg-slate-750/90 flex items-center justify-center shadow-sm relative group active:scale-95 cursor-pointer"
                    :title="
                        isDarkMode
                            ? 'Beralih ke Mode Terang'
                            : 'Beralih ke Mode Gelap'
                    "
                >
                    <PhSun
                        v-if="isDarkMode"
                        :size="20"
                        weight="bold"
                        class="text-amber-400"
                    />
                    <PhMoon
                        v-else
                        :size="20"
                        weight="bold"
                        class="text-sky-800"
                    />
                </button>

                <!-- Tombol Panduan Cara Penggunaan -->
                <button
                    @click="showGuide = true"
                    class="text-sky-800 hover:text-sky-950 dark:text-sky-200 dark:hover:text-white transition-all duration-250 w-10 h-10 rounded-xl border border-sky-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-slate-650 bg-sky-50/85 dark:bg-slate-800/80 hover:bg-sky-100/95 dark:hover:bg-slate-750/90 flex items-center justify-center shadow-sm relative group active:scale-95 cursor-pointer"
                    title="Panduan Cara Penggunaan"
                >
                    <PhQuestion :size="20" weight="bold" />
                </button>
            </div>
        </header>

        <!-- Main Workspace Area -->
        <main
            class="flex-grow max-w-7xl mx-auto w-full p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10"
        >
            <!-- Sisi Kiri: Canvas Preview (Col 1-7) -->
            <div
                class="lg:col-span-7 flex flex-col items-center justify-center bg-white/95 border border-sky-100/50 rounded-3xl p-6 shadow-xl backdrop-blur-md min-h-[550px] relative overflow-hidden group"
            >
                <!-- Top border glow highlight -->
                <div
                    class="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-sky-400/40 to-transparent"
                ></div>

                <h2
                    class="text-xs font-bold text-slate-500 mb-6 tracking-widest uppercase flex items-center gap-2"
                >
                    <span
                        class="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"
                    ></span>
                    Workspace Studio
                </h2>
                <ConfiguratorCanvas ref="canvasRef" />
            </div>

            <!-- Sisi Kanan: Panel Kontrol (Col 8-12) -->
            <div
                class="lg:col-span-5 relative w-full max-w-xl lg:max-w-none mx-auto"
            >
                <ControlPanel
                    :selected-object="canvasRef?.selectedObject"
                    :selected-object-rotation="
                        canvasRef?.selectedObjectRotation
                    "
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
                    @update-image-size="handleUpdateImageSize"
                    @deselect-object="handleDeselectObject"
                    @crop-selected-image="handleCropSelectedImage"
                    @update-rotation="handleUpdateRotation"
                />
            </div>
        </main>

        <!-- Modal Panduan Singkat (Premium Glassmorphism Backdrop) -->
        <Transition name="fade">
            <div
                v-if="showGuide"
                class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md"
                @click.self="showGuide = false"
            >
                <!-- Modal Content Container -->
                <div
                    class="bg-white/95 dark:bg-slate-900/95 border border-sky-100 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 md:p-8 relative flex flex-col gap-6 text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-250"
                >
                    <!-- Close Button -->
                    <button
                        @click="showGuide = false"
                        class="absolute top-4 right-4 md:top-6 md:right-6 bg-slate-100 hover:bg-slate-200/80 hover:text-slate-900 text-slate-500 p-2.5 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer"
                        title="Tutup Panduan"
                    >
                        <PhX :size="16" weight="bold" />
                    </button>

                    <!-- Modal Header -->
                    <div
                        class="flex items-center gap-3.5 border-b border-sky-100/80 dark:border-slate-800 pb-4.5"
                    >
                        <div
                            class="bg-gradient-to-tr from-sky-600 to-indigo-600 p-2.5 rounded-xl text-white shadow-md shadow-sky-600/20 flex items-center justify-center"
                        >
                            <PhQuestion :size="24" weight="bold" />
                        </div>
                        <div>
                            <h2
                                class="text-xl font-extrabold tracking-tight text-sky-950 dark:text-white"
                            >
                                Panduan Penggunaan KaoStudio
                            </h2>
                            <p
                                class="text-xs text-slate-500 dark:text-slate-400 font-semibold"
                            >
                                Langkah mudah mendesain sablon kaos Anda sendiri
                            </p>
                        </div>
                    </div>

                    <!-- Grid Panduan Singkat -->
                    <div
                        class="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto pr-1"
                    >
                        <!-- Langkah 1: Konfigurasi Kaos -->
                        <div class="flex gap-3">
                            <div
                                class="flex-shrink-0 w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-black text-sm"
                            >
                                1
                            </div>
                            <div class="space-y-1">
                                <h4 class="font-bold text-sm text-sky-950">
                                    Konfigurasi Kaos
                                </h4>
                                <p
                                    class="text-[11px] text-slate-600 leading-relaxed"
                                >
                                    Pilih sisi kaos antara
                                    <strong>Tampak Depan</strong> atau
                                    <strong>Tampak Belakang</strong>. Gunakan
                                    preset warna atau pemilih warna kustom untuk
                                    mengubah warna dasar kain kaos.
                                </p>
                            </div>
                        </div>

                        <!-- Langkah 2: Tambah Teks -->
                        <div class="flex gap-3">
                            <div
                                class="flex-shrink-0 w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-black text-sm"
                            >
                                2
                            </div>
                            <div class="space-y-1">
                                <h4 class="font-bold text-sm text-sky-950">
                                    Tambahkan Teks Desain
                                </h4>
                                <p
                                    class="text-[11px] text-slate-600 leading-relaxed"
                                >
                                    Ketik tulisan Anda, pilih jenis font Google,
                                    atur warna, dan klik
                                    <strong>Tambahkan Teks</strong>. Gunakan
                                    slider untuk mengatur ukuran font objek
                                    aktif.
                                </p>
                            </div>
                        </div>

                        <!-- Langkah 3: Unggah Logo/Gambar -->
                        <div class="flex gap-3">
                            <div
                                class="flex-shrink-0 w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-black text-sm"
                            >
                                3
                            </div>
                            <div class="space-y-1">
                                <h4 class="font-bold text-sm text-sky-950">
                                    Unggah Logo / Gambar
                                </h4>
                                <p
                                    class="text-[11px] text-slate-600 leading-relaxed"
                                >
                                    Klik area dropzone atau seret file gambar
                                    (PNG transparan sangat disarankan) langsung
                                    ke panel. Gambar dikompresi otomatis agar
                                    hemat memori.
                                </p>
                            </div>
                        </div>

                        <!-- Langkah 4: Kustomisasi Latar Belakang -->
                        <div class="flex gap-3">
                            <div
                                class="flex-shrink-0 w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-black text-sm"
                            >
                                4
                            </div>
                            <div class="space-y-1">
                                <h4 class="font-bold text-sm text-sky-950">
                                    Latar Belakang Mockup
                                </h4>
                                <p
                                    class="text-[11px] text-slate-600 leading-relaxed"
                                >
                                    Pilih backdrop studio yang sesuai: warna
                                    solid, pola catur transparan, studio radial
                                    gradasi modern, atau unggah foto ruangan
                                    Anda sendiri.
                                </p>
                            </div>
                        </div>

                        <!-- Langkah 5: Layering & Pengaturan -->
                        <div class="flex gap-3">
                            <div
                                class="flex-shrink-0 w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-black text-sm"
                            >
                                5
                            </div>
                            <div class="space-y-1">
                                <h4 class="font-bold text-sm text-sky-950">
                                    Atur Posisi & Lapisan
                                </h4>
                                <p
                                    class="text-[11px] text-slate-600 leading-relaxed"
                                >
                                    Posisikan objek di area sablon dengan geser,
                                    putar, atau perbesar skala. Klik objek lalu
                                    atur lapisan (Ke Depan/Belakang) atau hapus
                                    objek di panel bawah.
                                </p>
                            </div>
                        </div>

                        <!-- Langkah 6: Ekspor & Produksi -->
                        <div class="flex gap-3">
                            <div
                                class="flex-shrink-0 w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-black text-sm"
                            >
                                6
                            </div>
                            <div class="space-y-1">
                                <h4 class="font-bold text-sm text-sky-950">
                                    Unduh & Cetak
                                </h4>
                                <p
                                    class="text-[11px] text-slate-600 leading-relaxed"
                                >
                                    Gunakan <strong>Unduh Sablon</strong> (PNG
                                    transparan resolusi tinggi) untuk langsung
                                    naik cetak sablon DTF/DTG. Gunakan
                                    <strong>Unduh Mockup</strong> (JPG) untuk
                                    visualisasi mockup.
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Modal Footer -->
                    <div
                        class="border-t border-sky-100/80 pt-4 flex justify-between items-center"
                    >
                        <span
                            class="text-[10px] text-slate-450 font-bold uppercase tracking-wider"
                            >KaoStudio Guide v{{ appVersion }}</span
                        >
                        <button
                            @click="showGuide = false"
                            class="py-2.5 px-6 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all shadow-md shadow-sky-600/10 active:scale-95 cursor-pointer"
                        >
                            Mulai Mendesain
                        </button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- Modal Estimasi Harga -->
        <EstimasiHargaModal
            :show="showPricingEstimation"
            :canvas-ref="canvasRef"
            @close="showPricingEstimation = false"
        />

        <!-- Footer -->
        <footer
            class="bg-transparent py-5 px-6 text-center text-xs text-sky-300 relative z-10"
        >
            <p class="font-medium tracking-wide">
                &copy; 2026
                <span class="text-white font-bold">KaoStudio</span> v{{
                    appVersion
                }}
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

/* Transisi fade untuk modal panduan */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
