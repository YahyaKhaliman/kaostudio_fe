<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";
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
    PhUser,
    PhSignOut,
    PhCaretDown,
    PhCheckCircle,
    PhShieldCheck,
} from "@phosphor-icons/vue";
import { useConfiguratorStore } from "./stores/configurator";
import { useAuthStore } from "./stores/authStore";
import { fetchMockupDesign } from "./services/api";
import packageJson from "../package.json";
import EstimasiHargaModal from "./components/estimasiHarga.vue";
import LoginModal from "./components/loginModal.vue";

const appVersion = packageJson.version;
const showGuide = ref(false);
const store = useConfiguratorStore();
const authStore = useAuthStore();
const showPricingEstimation = ref(false);
const showLoginModal = ref(false);
const showUserDropdown = ref(false);
const showLogoutConfirmModal = ref(false);

// State Toast Notification
const toastMessage = ref<string | null>(null);
const toastType = ref<"success" | "info">("success");
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const triggerToast = (msg: string, type: "success" | "info" = "success") => {
    toastMessage.value = msg;
    toastType.value = type;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastMessage.value = null;
    }, 4000);
};

const handleLoginSuccess = () => {
    const name = authStore.user?.nama || "Admin Store";
    triggerToast(
        `Login Berhasil! Selamat datang ${name}. Akses Admin Store aktif.`,
        "success",
    );
    showLoginModal.value = false;
};

const handleLogoutClick = () => {
    showLogoutConfirmModal.value = true;
    showUserDropdown.value = false;
};

const confirmLogout = () => {
    const name = authStore.user?.nama || "User";
    authStore.logout();
    showLogoutConfirmModal.value = false;
    triggerToast(`Anda telah keluar dari akun ${name}.`, "info");
};

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

const checkAndLoadSharedDesign = async () => {
    const params = new URLSearchParams(window.location.search);
    const designId = params.get("designId");

    if (!designId) return;

    try {
        const data = await fetchMockupDesign(designId);
        if (data && data.canvasState) {
            let parsedState: any = null;
            try {
                parsedState =
                    typeof data.canvasState === "string"
                        ? JSON.parse(data.canvasState)
                        : data.canvasState;
            } catch (e) {
                console.error("Gagal parse canvasState:", e);
            }

            const resolveImageUrls = (obj: any): any => {
                if (!obj || typeof obj !== "object") return obj;
                if (Array.isArray(obj)) return obj.map(resolveImageUrls);
                const newObj: any = { ...obj };
                for (const key in newObj) {
                    const val = newObj[key];
                    if (typeof val === "string") {
                        // Jika URL mengandung /uploads/, ubah menjadi relative /uploads agar same-origin & anti-taint
                        if (val.includes("/uploads/")) {
                            const pathIndex = val.indexOf("/uploads/");
                            newObj[key] = val.substring(pathIndex);
                        }
                    } else if (typeof val === "object" && val !== null) {
                        newObj[key] = resolveImageUrls(val);
                    }
                }
                return newObj;
            };

            if (parsedState) {
                const cleanFront = resolveImageUrls(parsedState.front);
                const cleanBack = resolveImageUrls(parsedState.back);

                if (cleanFront) store.canvasStates.front = cleanFront;
                if (cleanBack) store.canvasStates.back = cleanBack;
                if (parsedState.fabric)
                    store.selectedFabric = parsedState.fabric;
                if (parsedState.shirtType)
                    store.currentShirtType = parsedState.shirtType;
                if (parsedState.sizes)
                    store.orderQuantities = { ...store.orderQuantities, ...parsedState.sizes };
                if (parsedState.currentSize) {
                    store.currentSize = parsedState.currentSize;
                } else if (parsedState.sizes) {
                    const activeEntry = Object.entries(parsedState.sizes).find(([_, qty]) => Number(qty) > 0);
                    if (activeEntry) {
                        store.currentSize = activeEntry[0] as any;
                    } else {
                        store.currentSize = "L";
                    }
                } else {
                    store.currentSize = "L";
                }
            }

            if (data.shirtColor) {
                store.shirtColor = data.shirtColor;
            }

            await nextTick();

            // Pemicu muat ulang kanvas & gambar mockup warna kaos
            if (canvasRef.value?.loadStateForView) {
                const targetView =
                    store.currentView === "both" ? "front" : store.currentView;
                await canvasRef.value.loadStateForView(targetView);
            }
            if (canvasRef.value?.initMockupImages) {
                await canvasRef.value.initMockupImages();
            }

            triggerToast(
                `Workspace Kode [${designId}] Berhasil Dimuat!`,
                "info",
            );
        }
    } catch (err: any) {
        console.error("Gagal memuat workspace shared:", err);
        triggerToast(
            `Gagal memuat desain [${designId}]: ${err.message || err}`,
            "info",
        );
    }
};

onMounted(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Muat data awal referensi produk dan warna dari API backend
    store.loadInitialData();
    checkAndLoadSharedDesign();

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
            class="bg-white/85 dark:bg-slate-900/85 border border-sky-100/60 dark:border-slate-800/80 px-4 sm:px-6 py-3 flex items-center justify-between shadow-lg dark:shadow-slate-950/40 backdrop-blur-md sticky top-3 sm:top-4 z-50 max-w-7xl mx-auto w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] rounded-2xl transition-all duration-300"
        >
            <!-- Sisi Kiri: Branding & Logo -->
            <div
                class="flex items-center space-x-3 group cursor-pointer"
                @click="store.loadInitialData()"
            >
                <div class="relative">
                    <img
                        src="/kaosan.png"
                        alt="Logo Kaosan"
                        class="w-10 h-10 object-contain rounded-xl shadow-md border border-sky-100/50 dark:border-slate-700/60 bg-white/10 group-hover:scale-105 transition-transform duration-300"
                    />
                    <span
                        class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"
                    ></span>
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <h1
                            class="text-lg font-black tracking-tight text-slate-900 dark:text-white leading-none"
                        >
                            KaoStudio
                        </h1>
                        <span
                            class="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 hidden sm:inline-block"
                        >
                            PRO
                        </span>
                    </div>
                    <p
                        class="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide mt-0.5"
                    >
                        Premium Clothing Mockup & Sablon Editor
                    </p>
                </div>
            </div>

            <!-- Sisi Kanan: Action Buttons -->
            <div class="flex items-center space-x-2">
                <!-- Tombol Estimasi Harga (Warna & Theme Matching) -->
                <button
                    @click="showPricingEstimation = true"
                    class="text-sky-800 dark:text-sky-200 hover:text-sky-950 dark:hover:text-white px-3.5 sm:px-4 h-10 rounded-xl border border-sky-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-slate-600 bg-sky-50/85 dark:bg-slate-800/80 hover:bg-sky-100/95 dark:hover:bg-slate-750/90 flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer font-bold text-xs transition-all duration-200"
                    title="Lihat Estimasi Harga Produksi & Sablon"
                >
                    <PhCalculator
                        :size="17"
                        weight="bold"
                        class="text-sky-600 dark:text-sky-400"
                    />
                    <span>Estimasi Harga</span>
                </button>

                <!-- Tombol Mode Gelap -->
                <button
                    @click="toggleDarkMode"
                    class="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all duration-200 w-10 h-10 rounded-xl border border-slate-200/80 dark:border-slate-700/80 hover:border-sky-300 dark:hover:border-slate-600 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-750 flex items-center justify-center shadow-sm relative group active:scale-95 cursor-pointer"
                    :title="
                        isDarkMode
                            ? 'Beralih ke Mode Terang'
                            : 'Beralih ke Mode Gelap'
                    "
                >
                    <PhSun
                        v-if="isDarkMode"
                        :size="19"
                        weight="bold"
                        class="text-amber-400 group-hover:rotate-45 transition-transform duration-300"
                    />
                    <PhMoon
                        v-else
                        :size="19"
                        weight="bold"
                        class="text-sky-700 group-hover:-rotate-12 transition-transform duration-300"
                    />
                </button>

                <!-- Tombol Panduan Cara Penggunaan -->
                <button
                    @click="showGuide = true"
                    class="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all duration-200 w-10 h-10 sm:w-auto sm:px-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 hover:border-sky-300 dark:hover:border-slate-600 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-750 flex items-center justify-center gap-1.5 shadow-sm relative group active:scale-95 cursor-pointer text-xs font-semibold"
                    title="Panduan Cara Penggunaan Studio"
                >
                    <PhQuestion
                        :size="19"
                        weight="bold"
                        class="text-sky-700 group-hover:rotate-45 transition-transform duration-300"
                    />
                    <!-- <span class="hidden sm:inline">Panduan</span> -->
                </button>

                <!-- Tombol Profile / Login User (Khusus Ikon dengan Pembeda Status Login) -->
                <!-- Scenario 1: Belum Login -->
                <div v-if="!authStore.isLoggedIn">
                    <button
                        @click="showLoginModal = true"
                        class="relative w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-sky-400 dark:hover:border-sky-500/60 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center shadow-sm active:scale-95 cursor-pointer transition-all duration-200 group"
                        title="Masuk / Login Admin Store"
                    >
                        <PhUser
                            :size="19"
                            weight="bold"
                            class="group-hover:scale-110 transition-transform duration-200"
                        />
                        <!-- Indikator Belum Login (Dot Abu-abu) -->
                        <span
                            class="absolute top-2 right-2 w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"
                        ></span>
                    </button>
                </div>

                <!-- Scenario 2: Sudah Login -->
                <div v-else class="relative">
                    <button
                        @click="showUserDropdown = !showUserDropdown"
                        class="relative w-10 h-10 rounded-xl border border-sky-400/80 dark:border-sky-500/80 bg-sky-50 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-750 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-sm cursor-pointer active:scale-95 transition-all duration-200 group"
                        :title="`Akun: ${authStore.user?.nama || 'User'} (${authStore.user?.role || 'Admin'})`"
                    >
                        <!-- Icon Person Berwarna (Tanpa Inisial) -->
                        <PhUser
                            :size="19"
                            weight="bold"
                            class="text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform duration-200"
                        />
                        <!-- Indikator Aktif Login (Dot Hijau Online + Pulse) -->
                        <span
                            class="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 ring-2 ring-white dark:ring-slate-900 rounded-full animate-pulse"
                        ></span>
                    </button>

                    <!-- Click Outside Overlay for User Dropdown -->
                    <div
                        v-if="showUserDropdown"
                        @click="showUserDropdown = false"
                        class="fixed inset-0 z-40 bg-transparent"
                    ></div>

                    <!-- Dropdown Menu Detail User -->
                    <Transition name="fade">
                        <div
                            v-if="showUserDropdown"
                            class="absolute right-0 mt-2 w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-sky-100 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-50 text-xs space-y-3 animate-in zoom-in-95 duration-150"
                        >
                            <div
                                class="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800"
                            >
                                <div
                                    class="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 dark:border-sky-400/20 flex items-center justify-center shrink-0"
                                >
                                    <PhUser :size="20" weight="bold" />
                                </div>
                                <div>
                                    <div
                                        class="font-extrabold text-slate-800 dark:text-white text-sm"
                                    >
                                        {{ authStore.user?.nama }}
                                    </div>
                                </div>
                            </div>

                            <!-- User Detail Info -->
                            <div
                                class="space-y-1.5 text-slate-600 dark:text-slate-300 font-medium"
                            >
                                <div class="flex justify-between">
                                    <span class="text-slate-400">Cabang:</span>
                                    <span
                                        class="font-bold text-sky-600 dark:text-sky-400"
                                        >{{
                                            (authStore.user as any)?.cabang ||
                                            "KDC"
                                        }}</span
                                    >
                                </div>
                            </div>

                            <!-- Logout Button -->
                            <button
                                @click="handleLogoutClick"
                                class="w-full py-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                            >
                                <PhSignOut :size="16" weight="bold" />
                                <span>Logout</span>
                            </button>
                        </div>
                    </Transition>
                </div>
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

        <!-- Toast Notification (Login / Logout Success Status) -->
        <Transition name="fade">
            <div
                v-if="toastMessage"
                class="fixed top-20 left-1/2 -translate-x-1/2 z-[110] max-w-md w-[calc(100%-2rem)] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-in slide-in-from-top duration-300"
                :class="
                    toastType === 'success'
                        ? 'border-emerald-500/40 text-emerald-950 dark:text-emerald-100'
                        : 'border-sky-500/40 text-sky-950 dark:text-sky-100'
                "
            >
                <div
                    class="p-2 rounded-xl shrink-0"
                    :class="
                        toastType === 'success'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                    "
                >
                    <PhCheckCircle
                        v-if="toastType === 'success'"
                        :size="22"
                        weight="bold"
                    />
                    <PhShieldCheck v-else :size="22" weight="bold" />
                </div>
                <div class="flex-1 text-xs font-bold leading-snug">
                    {{ toastMessage }}
                </div>
                <button
                    @click="toastMessage = null"
                    class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                >
                    <PhX :size="16" />
                </button>
            </div>
        </Transition>

        <!-- Modal Konfirmasi Logout -->
        <Transition name="fade">
            <div
                v-if="showLogoutConfirmModal"
                class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-955/75 backdrop-blur-md"
                @click.self="showLogoutConfirmModal = false"
            >
                <div
                    class="bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200"
                >
                    <div
                        class="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 flex items-center justify-center mx-auto"
                    >
                        <PhSignOut :size="24" weight="bold" />
                    </div>
                    <div>
                        <h3
                            class="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100"
                        >
                            LOGOUT
                        </h3>
                        <p
                            class="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed"
                        >
                            Apakah Anda yakin ingin keluar dari akun
                            <strong
                                class="text-slate-800 dark:text-slate-200 font-extrabold"
                                >{{
                                    authStore.user?.nama || "Admin Store"
                                }}</strong
                            >?
                        </p>
                    </div>
                    <div class="flex items-center justify-center gap-3 pt-2">
                        <button
                            @click="showLogoutConfirmModal = false"
                            class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                        >
                            Batal
                        </button>
                        <button
                            @click="confirmLogout"
                            class="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold tracking-wider shadow-sm transition-all cursor-pointer active:scale-95"
                        >
                            Logout
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

        <!-- Modal Quick Login Admin -->
        <LoginModal
            :isOpen="showLoginModal"
            @close="showLoginModal = false"
            @success="handleLoginSuccess"
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
