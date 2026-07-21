<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useConfiguratorStore } from "../stores/configurator";
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
    PhPlus,
    PhEye,
    PhCaretDown,
    PhRuler,
    PhX,
    PhCrop,
} from "@phosphor-icons/vue";

import { compressImage, formatBytes } from "../utils/imageCompressor";
import { presetColors, companyColors, type ColorItem } from "../utils/colors";
import sizeChartImg from "../assets/images/size_chart.png";
import ImageCropperModal from "./imageCropperModal.vue";

const props = defineProps<{
    selectedObject: any;
    selectedObjectRotation?: number;
}>();

const emit = defineEmits<{
    (e: "add-text", text: string, color: string, font: string): void;
    (e: "add-image", file: File | string): void;
    (e: "delete-selected"): void;
    (e: "bring-to-front"): void;
    (e: "send-to-back"): void;
    (e: "export-mockup", view: "front" | "back" | "both"): void;
    (e: "export-print", view: "front" | "back" | "both"): void;
    (e: "update-text", text: string): void;
    (e: "update-color", color: string): void;
    (e: "update-font", font: string): void;
    (e: "update-font-size", size: number): void;
    (e: "update-image-size", widthCm: number, heightCm: number): void;
    (e: "deselect-object"): void;
    (e: "crop-selected-image", croppedDataUrl: string): void;
    (e: "update-rotation", angle: number): void;
}>();

const store = useConfiguratorStore();
const showSizeGuide = ref(false);

// State Accordion Panel Kontrol (Membuka panel secara mandiri dan bersamaan)
const isShirtOpen = ref(true);
const isShirtFullyOpen = ref(true);
const isTextOpen = ref(false);
const isUploadOpen = ref(false);
const isBackdropOpen = ref(false);
const isExportOpen = ref(false);
const isExportFullyOpen = ref(false);

watch(isExportOpen, (isOpen) => {
    if (!isOpen) {
        isPrintDropdownOpen.value = false;
        isMockupDropdownOpen.value = false;
    }
});

// State Dropdown Ekspor
const isPrintDropdownOpen = ref(false);
const isMockupDropdownOpen = ref(false);

// State Dropdown Model Kaos & Sisi Tampilan
const isModelDropdownOpen = ref(false);
const isViewDropdownOpen = ref(false);

const handlePrintExport = (view: "front" | "back" | "both") => {
    emit("export-print", view);
    isPrintDropdownOpen.value = false;
};
const handleMockupExport = (view: "front" | "back" | "both") => {
    emit("export-mockup", view);
    isMockupDropdownOpen.value = false;
};

// Template Ref
const fileInput = ref<HTMLInputElement | null>(null);
const triggerFileInput = () => {
    fileInput.value?.click();
};

// State Input
const textInput = ref("");
const textColor = ref("#7c3aed"); // default violet
const textFont = ref("Inter");
const fontSize = ref(24);
const uploadError = ref("");

// State Pencarian & Hover Warna
const searchQuery = ref("");
const originalColor = ref<string | null>(null);
const hoveredColorName = ref("");

const previewColor = (hex: string, name: string = "") => {
    if (originalColor.value === null) {
        originalColor.value = store.shirtColor;
    }
    store.shirtColor = hex;
    if (name) {
        hoveredColorName.value = name;
    }
};

const restoreColor = () => {
    if (originalColor.value !== null) {
        store.shirtColor = originalColor.value;
        originalColor.value = null;
    }
    hoveredColorName.value = "";
};

const commitColor = (hex: string) => {
    store.shirtColor = hex;
    originalColor.value = hex;
    store.saveToLocalStorage();
};

// Menggunakan rujukan terpusat dari Pinia Store untuk meminimalkan kompleksitas logika
const activeColors = computed(() => store.activeColors);
const activeProduct = computed(() => store.activeProduct);

const activeColorName = computed(() => {
    const matched = activeColors.value.find(
        (c) => c.hex.toLowerCase() === store.shirtColor.toLowerCase(),
    );
    return matched ? matched.name : "PILIH WARNA PRODUKSI";
});

const filteredColors = computed(() => {
    const sorted = [...activeColors.value].sort((a, b) =>
        a.name.localeCompare(b.name),
    );
    if (!searchQuery.value) return sorted;
    return sorted.filter((color) =>
        color.name.toLowerCase().includes(searchQuery.value.toLowerCase()),
    );
});

// Daftar lengkap semua ukuran standar (termasuk XS) — diambil dari seluruh data produk
const allStandardSizes = computed(() => {
    const sizeOrder = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
    const allSizes = new Set<string>();

    // Kumpulkan semua ukuran unik dari seluruh produk
    const products = store.productsData;
    if (products) {
        Object.values(products).forEach((items: any[]) => {
            items.forEach((item) => {
                if (item.ukuran_list) {
                    item.ukuran_list.forEach((u: any) =>
                        allSizes.add(u.ukuran),
                    );
                }
            });
        });
    }

    // Jika tidak ada data, gunakan fallback lengkap
    if (allSizes.size === 0) return sizeOrder;

    // Urutkan sesuai urutan standar
    return sizeOrder.filter((s) => allSizes.has(s));
});

// Ambil ukuran aktif yang diproduksi (harga > 0) untuk produk terpilih
const availableSizes = computed(() => {
    if (
        !activeProduct.value ||
        !activeProduct.value.ukuran_list ||
        activeProduct.value.ukuran_list.length === 0
    ) {
        return ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
    }
    return activeProduct.value.ukuran_list.map((u) => u.ukuran);
});

const isSizeAvailable = (size: string) => {
    return availableSizes.value.includes(size);
};

// Ambil nominal harga untuk ukuran aktif yang dipilih
const activeSizePrice = computed(() => {
    if (!activeProduct.value || !activeProduct.value.ukuran_list) return null;
    const match = activeProduct.value.ukuran_list.find(
        (u) => u.ukuran === store.currentSize,
    );
    return match ? match.harga : null;
});

// Watcher untuk sinkronisasi model dan warna saat bahan kain diubah
watch(
    () => store.selectedFabric,
    (newFabric) => {
        const model = store.currentShirtType;
        const colorsForModel = store.colorsData[newFabric]?.[model] || [];
        if (colorsForModel.length === 0) {
            // Cari model lain di bahan kain baru yang memiliki warna
            const models: ("tshirt" | "longTshirt" | "polo")[] = [
                "tshirt",
                "longTshirt",
                "polo",
            ];
            const fallbackModel = models.find(
                (m) => (store.colorsData[newFabric]?.[m] || []).length > 0,
            );
            if (fallbackModel) {
                store.currentShirtType = fallbackModel;
            }
        }

        // Pilih warna pertama dari opsi yang tersedia
        const activeCols = activeColors.value;
        if (activeCols.length > 0 && activeCols[0]) {
            commitColor(activeCols[0].hex);
        }
    },
);

// Watcher untuk mereset warna jika tipe model diubah dan warna saat ini tidak tersedia di model baru
watch(
    () => store.currentShirtType,
    () => {
        const activeCols = activeColors.value;
        const hasCurrentColor = activeCols.some(
            (c) => c.hex.toLowerCase() === store.shirtColor.toLowerCase(),
        );
        if (!hasCurrentColor && activeCols.length > 0 && activeCols[0]) {
            commitColor(activeCols[0].hex);
        }
    },
);

// State untuk popover notifikasi perpindahan ukuran otomatis
const sizeAutoSwitchMsg = ref<string | null>(null);
let sizeAutoSwitchTimer: ReturnType<typeof setTimeout> | null = null;

const showSizeAutoSwitch = (fromSize: string, _toSize?: string) => {
    sizeAutoSwitchMsg.value = fromSize;
    if (sizeAutoSwitchTimer) clearTimeout(sizeAutoSwitchTimer);
    sizeAutoSwitchTimer = setTimeout(() => {
        sizeAutoSwitchMsg.value = null;
    }, 3500);
};

// Watcher untuk menyesuaikan ukuran aktif jika tidak tersedia di daftar ukuran produk terpilih
// Mencari ukuran terdekat berdasarkan selisih indeks terkecil (Math.abs)
watch(availableSizes, (newSizes) => {
    const currentSize = store.currentSize as string;
    if (newSizes.length > 0 && !newSizes.includes(currentSize as any)) {
        const sizeOrder = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
        const currentIdx = sizeOrder.indexOf(currentSize);

        let nearest: string | null = null;

        if (currentIdx !== -1) {
            let minDistance = Infinity;
            for (const size of newSizes) {
                const idx = sizeOrder.indexOf(size);
                if (idx !== -1) {
                    const distance = Math.abs(idx - currentIdx);
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearest = size;
                    }
                }
            }
        }

        const targetSize = nearest || newSizes[0] || "";
        showSizeAutoSwitch(currentSize, targetSize);
        store.currentSize = targetSize as any;
    }
});

const selectCompanyColor = (color: { name: string; hex: string }) => {
    commitColor(color.hex);
};

// Tutup otomatis semua dropdown kaos jika accordion utama ditutup
watch(isShirtOpen, (isOpen) => {
    if (!isOpen) {
        isModelDropdownOpen.value = false;
        isViewDropdownOpen.value = false;
        searchQuery.value = "";
    }
});

// Antarmuka Opsi Model Terpadu (Kombinasi Bahan & Model Lengan)
interface ShirtOption {
    id: string;
    label: string;
    fabric: string;
    model: "tshirt" | "longTshirt" | "polo";
}

const shirtOptions = computed<ShirtOption[]>(() => {
    const options: ShirtOption[] = [];
    const fabrics = Object.keys(store.productsData); // ["COMBED 30S", "COMBED 24S", "POLO LACOS CVC"]

    fabrics.forEach((fabric) => {
        const products = store.productsData[fabric] || [];

        const hasShort = products.some(
            (p) => p.brg_jeniskaos === "KO" && p.brg_lengan === "PENDEK",
        );
        const hasLong = products.some(
            (p) => p.brg_jeniskaos === "KO" && p.brg_lengan === "PANJANG",
        );
        const hasPolo = products.some((p) => p.brg_jeniskaos === "KK");

        if (hasShort) {
            options.push({
                id: `${fabric}-tshirt`,
                label: `Kaos Pendek - ${fabric}`,
                fabric,
                model: "tshirt",
            });
        }
        if (hasLong) {
            options.push({
                id: `${fabric}-longTshirt`,
                label: `Kaos Panjang - ${fabric}`,
                fabric,
                model: "longTshirt",
            });
        }
        if (hasPolo) {
            options.push({
                id: `${fabric}-polo`,
                label: `Polo - ${fabric}`,
                fabric,
                model: "polo",
            });
        }
    });
    return options;
});

const activeOption = computed(() => {
    const fabric = store.selectedFabric;
    const model = store.currentShirtType;
    return (
        shirtOptions.value.find(
            (opt) => opt.fabric === fabric && opt.model === model,
        ) || shirtOptions.value[0]
    );
});

const selectShirtOption = (opt: ShirtOption) => {
    store.selectedFabric = opt.fabric;
    store.currentShirtType = opt.model;
    store.saveToLocalStorage();
    isModelDropdownOpen.value = false;
};

// Daftar Font Google
const fontList = [
    "Inter",
    "Montserrat",
    "Playfair Display",
    "Poppins",
    "Oswald",
];

// Mendeteksi apakah objek yang dipilih adalah teks
const isTextSelected = computed(() => {
    return (
        props.selectedObject &&
        ["i-text", "text", "textbox"].includes(props.selectedObject.type)
    );
});

// Sinkronisasi input form saat objek teks di kanvas dipilih
watch(
    () => props.selectedObject,
    (newObj) => {
        if (newObj && ["i-text", "text", "textbox"].includes(newObj.type)) {
            textInput.value = newObj.text || "";
            textColor.value = newObj.fill || "#000000";
            textFont.value = newObj.fontFamily || "Inter";
            fontSize.value = newObj.fontSize || 24;

            // Auto buka accordion Teks ketika objek teks dipilih di Canvas
            isTextOpen.value = true;
        } else if (!newObj) {
            textInput.value = "";
        }
    },
    { deep: true },
);

// Tutup otomatis panel teks dan upload jika masuk ke mode preview 'both'
watch(
    () => store.currentView,
    (newView) => {
        if (newView === "both") {
            isTextOpen.value = false;
            isUploadOpen.value = false;
        }
    },
);

// Pemicu pembaruan saat pengguna mengubah input ketika objek teks sedang aktif
const handleTextChange = () => {
    if (isTextSelected.value) {
        emit("update-text", textInput.value);
    }
};

const handleColorChange = () => {
    if (isTextSelected.value) {
        emit("update-color", textColor.value);
    }
};

const handleFontChange = () => {
    if (isTextSelected.value) {
        emit("update-font", textFont.value);
    }
};

const handleFontSizeChange = () => {
    if (isTextSelected.value) {
        emit("update-font-size", fontSize.value);
    }
};

// Menambahkan teks baru
const handleAddText = () => {
    if (!textInput.value.trim()) return;
    emit("add-text", textInput.value, textColor.value, textFont.value);
    if (!isTextSelected.value) {
        textInput.value = ""; // reset input jika menambahkan teks baru
    }
};

// Proses kompresi dan simpan gambar
const processAndUploadImage = async (file: File) => {
    uploadError.value = "";

    // Pengaman: Batasi ukuran file mentah maksimal 10MB
    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        uploadError.value = `Ukuran file terlalu besar (${formatBytes(file.size)}). Maksimal berkas adalah 10MB.`;
        return;
    }

    try {
        // Kompresi gambar di sisi klien ke dimensi maks 1000px dengan kualitas 80%
        const compressed = await compressImage(file, 1000, 0.8);

        // Simpan ke storage store sementara
        store.addUploadedImage(
            file.name,
            compressed.dataUrl,
            compressed.compressedSize,
            file.size,
        );

        // Emit dataURL gambar terkompresi langsung ke canvas
        emit("add-image", compressed.dataUrl);
    } catch (err: any) {
        uploadError.value =
            err.message || "Gagal memproses dan mengompres gambar.";
        console.error(err);
    }
};

// Menangani unggah gambar kustom
const handleFileUpload = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        processAndUploadImage(target.files[0]);
        target.value = ""; // Reset input file
    }
};

// Template Ref & Handler untuk Latar Belakang Kustom
const backdropFileInput = ref<HTMLInputElement | null>(null);
const triggerBackdropFileInput = () => {
    backdropFileInput.value?.click();
};
const handleBackdropUpload = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        const file = target.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const url = e.target?.result as string;
            store.customBackdropUrl = url;
            store.backdropType = "custom";
        };
        reader.readAsDataURL(file);
    }
};

// Menangani drag and drop gambar
const isDragActive = ref(false);
const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    isDragActive.value = true;
};
const onDragLeave = () => {
    isDragActive.value = false;
};
const onDrop = (e: DragEvent) => {
    e.preventDefault();
    isDragActive.value = false;
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith("image/")) {
            processAndUploadImage(file);
        }
    }
};

const applyImageTemplateSize = (widthCm: number, heightCm: number) => {
    emit("update-image-size", widthCm, heightCm);
};

// State Modal Crop Gambar
const isCropModalOpen = ref(false);
const imageToCropUrl = ref("");
const imageToCropName = ref("");
const imageToCropId = ref<string | null>(null);

// State Rotasi Objek Presisi
const objectRotation = ref(0);

const openCropForUpload = (img: {
    id: string;
    name: string;
    dataUrl: string;
}) => {
    imageToCropUrl.value = img.dataUrl;
    imageToCropName.value = img.name;
    imageToCropId.value = img.id;
    isCropModalOpen.value = true;
};

const openCropForSelected = () => {
    if (props.selectedObject && props.selectedObject.type === "image") {
        const element = props.selectedObject.getElement();
        if (element && element.src) {
            imageToCropUrl.value = element.src;
            imageToCropName.value = "desain-canvas-cropped.png";
            imageToCropId.value = "selected-canvas-image";
            isCropModalOpen.value = true;
        }
    }
};

const handleCropComplete = (croppedDataUrl: string) => {
    isCropModalOpen.value = false;

    if (imageToCropId.value === "selected-canvas-image") {
        emit("crop-selected-image", croppedDataUrl);
    } else {
        const croppedName = imageToCropName.value.replace(
            /(\.[\w\d]+)$/,
            "-cropped$1",
        );
        const estimatedSize = Math.round(croppedDataUrl.length * 0.75);

        store.addUploadedImage(
            croppedName,
            croppedDataUrl,
            estimatedSize,
            estimatedSize,
        );

        emit("add-image", croppedDataUrl);
    }
};

const handleRotationChange = () => {
    // Batasi nilai agar tetap 0 - 360
    let cleanRot = parseInt(objectRotation.value as any);
    if (isNaN(cleanRot)) cleanRot = 0;
    cleanRot = ((cleanRot % 360) + 360) % 360;
    objectRotation.value = cleanRot;
    emit("update-rotation", cleanRot);
};

watch(
    () => props.selectedObjectRotation,
    (newRot) => {
        if (newRot !== undefined) {
            objectRotation.value = newRot;
        } else {
            objectRotation.value = 0;
        }
    },
    { immediate: true },
);
</script>

<template>
    <div
        class="bg-white/95 dark:bg-slate-900/95 border border-sky-100 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 text-slate-800 dark:text-slate-100 backdrop-blur-md relative overflow-hidden transition-all duration-300"
    >
        <!-- Top thin glow decoration -->
        <div
            class="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-sky-400/50 to-transparent"
        ></div>

        <!-- BAGIAN Pengaturan Objek Layer / Hapus (Hanya muncul jika ada objek dipilih) -->
        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-2 scale-95"
            enter-to-class="opacity-100 translate-y-0 scale-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0 scale-100"
            leave-to-class="opacity-0 -translate-y-2 scale-95"
        >
            <div
                v-if="selectedObject"
                class="space-y-3 p-4 bg-slate-50/70 dark:bg-slate-950/45 border border-sky-100/60 dark:border-slate-800 rounded-2xl transition-all duration-300 relative overflow-hidden shadow-sm"
            >
                <h4
                    class="text-[10px] font-black uppercase tracking-widest text-sky-800 dark:text-sky-400 pl-1 flex items-center gap-1.5"
                >
                    <span
                        class="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping"
                    ></span>
                    <span>Pengaturan Objek Terpilih</span>
                </h4>
                <div class="grid grid-cols-3 gap-2">
                    <button
                        @click="emit('bring-to-front')"
                        class="py-2 px-2.5 text-[9px] font-bold uppercase tracking-wider bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 hover:border-sky-300 dark:hover:border-slate-700 hover:bg-sky-50 dark:hover:bg-slate-850 rounded-xl text-slate-750 dark:text-slate-350 hover:text-sky-600 dark:hover:text-sky-400 transition-all flex items-center justify-center gap-1 hover:scale-102 active:scale-98 shadow-sm cursor-pointer"
                        type="button"
                    >
                        <PhArrowUp :size="12" weight="bold" />
                        <span>Ke Depan</span>
                    </button>
                    <button
                        @click="emit('send-to-back')"
                        class="py-2 px-2.5 text-[9px] font-bold uppercase tracking-wider bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 hover:border-sky-300 dark:hover:border-slate-700 hover:bg-sky-50 dark:hover:bg-slate-850 rounded-xl text-slate-750 dark:text-slate-355 hover:text-sky-600 dark:hover:text-sky-400 transition-all flex items-center justify-center gap-1 hover:scale-102 active:scale-98 shadow-sm cursor-pointer"
                        type="button"
                    >
                        <PhArrowDown :size="12" weight="bold" />
                        <span>Ke Belakang</span>
                    </button>
                    <button
                        @click="emit('delete-selected')"
                        class="py-2 px-2.5 text-[9px] font-bold uppercase tracking-wider bg-white dark:bg-slate-900 border border-red-100 dark:border-red-950/45 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-all flex items-center justify-center gap-1 hover:scale-102 active:scale-98 shadow-sm cursor-pointer"
                        type="button"
                    >
                        <PhTrash :size="12" weight="bold" />
                        <span>Hapus</span>
                    </button>
                </div>

                <!-- Kontrol Rotasi Akurat (Untuk Semua Tipe Objek Terpilih) -->
                <div
                    class="space-y-1.5 pt-3 border-t border-sky-100/50 dark:border-slate-800/80"
                >
                    <div
                        class="flex justify-between items-center text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-wider pl-1"
                    >
                        <span>Rotasi Objek:</span>
                        <span
                            class="font-mono text-sky-600 dark:text-sky-400 font-bold"
                            >{{ objectRotation }}°</span
                        >
                    </div>
                    <div class="flex items-center gap-3">
                        <input
                            type="range"
                            v-model.number="objectRotation"
                            @input="handleRotationChange"
                            min="0"
                            max="360"
                            step="1"
                            class="flex-grow accent-sky-600 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-lg cursor-pointer transition-all"
                        />
                        <div class="flex items-center">
                            <input
                                type="number"
                                v-model.number="objectRotation"
                                @input="handleRotationChange"
                                min="0"
                                max="360"
                                step="1"
                                class="w-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center rounded-lg py-0.5 text-[9.5px] font-mono font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                            <span
                                class="text-[10px] font-bold text-slate-400 dark:text-slate-500 ml-0.5"
                                >°</span
                            >
                        </div>
                    </div>
                </div>

                <!-- Pengaturan Ukuran Template Gambar (Hanya muncul jika objek terpilih berupa Gambar) -->
                <div
                    v-if="selectedObject.type === 'image'"
                    class="space-y-2 pt-3 border-t border-sky-100/50 dark:border-slate-800/80"
                >
                    <label
                        class="block text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-wider pl-1"
                    >
                        Ukuran Cetak Sablon (Template):
                    </label>
                    <div class="grid grid-cols-3 gap-1.5">
                        <button
                            v-for="tpl in [
                                { name: 'A3', w: 29.7, h: 42.0 },
                                { name: 'A4', w: 21.0, h: 29.7 },
                                { name: 'A5', w: 14.8, h: 21.0 },
                                { name: 'A6', w: 10.5, h: 14.8 },
                                { name: 'Logo 8x8', w: 8.0, h: 8.0 },
                                { name: 'Logo 10x10', w: 10.0, h: 10.0 },
                            ]"
                            :key="tpl.name"
                            @click="applyImageTemplateSize(tpl.w, tpl.h)"
                            class="py-1.5 px-1 text-[8.5px] font-extrabold uppercase rounded-lg border border-sky-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-300 dark:hover:border-slate-700 hover:bg-sky-50 dark:hover:bg-slate-850 text-slate-750 dark:text-slate-350 transition-all hover:scale-102 active:scale-98 cursor-pointer text-center"
                            type="button"
                            :title="`Skalakan gambar proporsional ke ukuran maks ${tpl.w} x ${tpl.h} cm`"
                        >
                            {{ tpl.name }}
                        </button>
                    </div>
                    <span
                        class="block text-[7.5px] text-slate-400 dark:text-slate-500 italic pl-1 leading-normal"
                    >
                        * Skala gambar akan disesuaikan secara proporsional
                        sesuai rasio asli (bebas distorsi).
                    </span>

                    <!-- Tombol Potong Gambar di Kanvas -->
                    <div class="pt-2">
                        <button
                            @click="openCropForSelected"
                            class="w-full py-2 px-3 rounded-xl bg-sky-600/10 hover:bg-sky-600 border border-sky-200/50 dark:border-slate-800 text-sky-700 dark:text-sky-400 hover:text-white dark:hover:text-white font-bold text-xs transition-all duration-300 flex items-center justify-center gap-1.5 hover:scale-102 active:scale-98 cursor-pointer"
                            type="button"
                        >
                            <PhCrop :size="13" weight="bold" />
                            <span>Potong Gambar (Crop)</span>
                        </button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- Container Accordion -->
        <div class="space-y-3">
            <!-- 1. Konfigurasi Kaos Accordion -->
            <div
                class="border rounded-2xl transition-all duration-300 bg-white/40 dark:bg-slate-900/10"
                :class="[
                    isShirtOpen
                        ? 'border-sky-200 dark:border-slate-750 bg-white dark:bg-slate-900/30 shadow-[0_4px_20px_-2px_rgba(14,165,233,0.05)]'
                        : 'border-sky-100/60 dark:border-slate-800/80 hover:border-sky-200/60 dark:hover:border-slate-750',
                    { 'overflow-hidden': !isShirtFullyOpen },
                ]"
            >
                <button
                    @click="isShirtOpen = !isShirtOpen"
                    class="w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-300 text-left cursor-pointer outline-none select-none"
                    :class="[
                        isShirtOpen
                            ? 'bg-sky-50/50 dark:bg-slate-950/40 border-b border-sky-100/60 dark:border-slate-800/80 text-sky-950 dark:text-white font-extrabold'
                            : 'text-slate-700 dark:text-slate-350 hover:bg-slate-50/40 dark:hover:bg-slate-900/50',
                    ]"
                    type="button"
                >
                    <div class="flex items-center gap-3">
                        <div
                            :class="[
                                'p-2 rounded-xl transition-all duration-355 ease-out',
                                isShirtOpen
                                    ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 scale-110 rotate-3'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500',
                            ]"
                        >
                            <PhTShirt :size="16" weight="bold" />
                        </div>
                        <div>
                            <span
                                class="text-[11px] font-black uppercase tracking-wider block"
                                >Konfigurasi Kaos</span
                            >
                            <span
                                class="text-[9px] font-medium text-slate-400 dark:text-slate-500 block mt-0.5"
                            >
                                {{
                                    store.currentShirtType === "tshirt"
                                        ? "T-Shirt"
                                        : store.currentShirtType ===
                                            "longTshirt"
                                          ? "Lengan Pjg"
                                          : "Polo"
                                }}
                                • {{ store.currentSize }} •
                                {{ activeColorName }}
                            </span>
                        </div>
                    </div>
                    <PhCaretDown
                        :size="14"
                        weight="bold"
                        class="text-slate-400 transition-transform duration-300 mr-1"
                        :class="{
                            'transform rotate-180 text-sky-500': isShirtOpen,
                        }"
                    />
                </button>

                <Transition
                    enter-active-class="transition-all duration-300 ease-out"
                    enter-from-class="max-h-0 opacity-0 transform -translate-y-2"
                    enter-to-class="max-h-[800px] opacity-100 transform translate-y-0"
                    leave-active-class="transition-all duration-250 ease-in"
                    leave-from-class="max-h-[800px] opacity-100 transform translate-y-0"
                    leave-to-class="max-h-0 opacity-0 transform -translate-y-2"
                    @after-enter="isShirtFullyOpen = true"
                    @before-leave="isShirtFullyOpen = false"
                >
                    <div
                        v-show="isShirtOpen"
                        class="p-4 bg-white/30 dark:bg-slate-900/10 space-y-4"
                    >
                        <!-- Model Kaos & Sisi Tampilan (Symmetric Dropdowns) -->
                        <div class="grid grid-cols-2 gap-3 relative">
                            <!-- Overlay click-away untuk Model & View -->
                            <div
                                v-if="isModelDropdownOpen || isViewDropdownOpen"
                                @click="
                                    isModelDropdownOpen = false;
                                    isViewDropdownOpen = false;
                                "
                                class="fixed inset-0 z-20 cursor-default bg-transparent"
                            ></div>

                            <!-- Model Kaos -->
                            <div class="space-y-1.5 relative">
                                <label
                                    class="block text-[9.5px] uppercase font-black text-slate-455 dark:text-slate-500 tracking-wider pl-1"
                                    >Model Kaos</label
                                >
                                <div class="relative w-full">
                                    <button
                                        @click.stop="
                                            isModelDropdownOpen =
                                                !isModelDropdownOpen;
                                            isViewDropdownOpen = false;
                                        "
                                        class="w-full flex items-center justify-between py-2 px-2.5 rounded-xl border border-sky-100/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-slate-100/60 dark:hover:bg-slate-900/50 transition-all text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer outline-none active:scale-[0.98] relative z-25"
                                        type="button"
                                    >
                                        <div
                                            class="flex items-center gap-1.5 min-w-0"
                                        >
                                            <div
                                                class="text-sky-600 dark:text-sky-400 flex-shrink-0"
                                            >
                                                <svg
                                                    v-if="
                                                        store.currentShirtType ===
                                                        'tshirt'
                                                    "
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="2.5"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    class="w-3.5 h-3.5"
                                                >
                                                    <path
                                                        d="M9 4a3 3 0 0 0 6 0"
                                                    />
                                                    <path
                                                        d="M9 4H6L3 9h3v11h12V9h3l-3-5h-3"
                                                    />
                                                </svg>
                                                <svg
                                                    v-else-if="
                                                        store.currentShirtType ===
                                                        'longTshirt'
                                                    "
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="2.5"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    class="w-3.5 h-3.5"
                                                >
                                                    <path
                                                        d="M9 4a3 3 0 0 0 6 0"
                                                    />
                                                    <path
                                                        d="M9 4H6L2 14h2.5l2-6v12h11V8l2 6h2.5l-4-10h-3"
                                                    />
                                                </svg>
                                                <svg
                                                    v-else-if="
                                                        store.currentShirtType ===
                                                        'polo'
                                                    "
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="2.5"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    class="w-3.5 h-3.5"
                                                >
                                                    <path
                                                        d="M9 4H6L3 9h3v11h12V9h3l-3-5h-3"
                                                    />
                                                    <path d="M9 4l3 3 3-3" />
                                                    <path d="M12 7v5" />
                                                    <circle
                                                        cx="12"
                                                        cy="8.5"
                                                        r="0.5"
                                                        fill="currentColor"
                                                    />
                                                    <circle
                                                        cx="12"
                                                        cy="10.5"
                                                        r="0.5"
                                                        fill="currentColor"
                                                    />
                                                </svg>
                                            </div>
                                            <span
                                                class="truncate text-[10px] font-extrabold uppercase tracking-wide"
                                            >
                                                {{
                                                    activeOption?.label ||
                                                    "PILIH MODEL KAOS"
                                                }}
                                            </span>
                                        </div>
                                        <PhCaretDown
                                            :size="10"
                                            weight="bold"
                                            class="text-slate-400 dark:text-slate-500 transition-transform duration-300 flex-shrink-0"
                                            :class="{
                                                'transform rotate-180':
                                                    isModelDropdownOpen,
                                            }"
                                        />
                                    </button>

                                    <!-- Dropdown Menu -->
                                    <Transition name="dropdown">
                                        <div
                                            v-if="isModelDropdownOpen"
                                            class="absolute top-full mt-1.5 left-0 right-0 bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-2xl shadow-xl z-30 p-1.5 space-y-0.5"
                                        >
                                            <button
                                                v-for="opt in shirtOptions"
                                                :key="opt.id"
                                                @click="selectShirtOption(opt)"
                                                class="w-full py-1.5 px-2.5 rounded-xl text-left text-[10px] font-bold text-slate-700 dark:text-slate-350 hover:bg-sky-50 dark:hover:bg-slate-850 hover:text-sky-600 dark:hover:text-sky-400 transition-all flex items-center justify-between cursor-pointer border-0 outline-none bg-transparent"
                                                type="button"
                                            >
                                                <div
                                                    class="flex items-center gap-2 min-w-0"
                                                >
                                                    <svg
                                                        v-if="
                                                            opt.model ===
                                                            'tshirt'
                                                        "
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        stroke-width="2.2"
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0"
                                                    >
                                                        <path
                                                            d="M9 4a3 3 0 0 0 6 0"
                                                        />
                                                        <path
                                                            d="M9 4H6L3 9h3v11h12V9h3l-3-5h-3"
                                                        />
                                                    </svg>
                                                    <svg
                                                        v-else-if="
                                                            opt.model ===
                                                            'longTshirt'
                                                        "
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        stroke-width="2.2"
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0"
                                                    >
                                                        <path
                                                            d="M9 4a3 3 0 0 0 6 0"
                                                        />
                                                        <path
                                                            d="M9 4H6L2 14h2.5l2-6v12h11V8l2 6h2.5l-4-10h-3"
                                                        />
                                                    </svg>
                                                    <svg
                                                        v-else-if="
                                                            opt.model === 'polo'
                                                        "
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        stroke-width="2.2"
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0"
                                                    >
                                                        <path
                                                            d="M9 4H6L3 9h3v11h12V9h3l-3-5h-3"
                                                        />
                                                        <path
                                                            d="M9 4l3 3 3-3"
                                                        />
                                                        <path d="M12 7v5" />
                                                        <circle
                                                            cx="12"
                                                            cy="8.5"
                                                            r="0.5"
                                                            fill="currentColor"
                                                        />
                                                        <circle
                                                            cx="12"
                                                            cy="10.5"
                                                            r="0.5"
                                                            fill="currentColor"
                                                        />
                                                    </svg>
                                                    <div class="min-w-0">
                                                        <div
                                                            class="font-extrabold uppercase text-[9px] truncate"
                                                        >
                                                            {{ opt.label }}
                                                        </div>
                                                        <div
                                                            class="text-[7.5px] text-slate-400 dark:text-slate-500 font-medium truncate"
                                                        >
                                                            {{ opt.fabric }}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span
                                                    v-if="
                                                        store.selectedFabric ===
                                                            opt.fabric &&
                                                        store.currentShirtType ===
                                                            opt.model
                                                    "
                                                    class="text-sky-500 font-extrabold text-[9px] flex-shrink-0"
                                                    >✓</span
                                                >
                                            </button>
                                        </div>
                                    </Transition>
                                </div>
                            </div>

                            <!-- Sisi Tampilan -->
                            <div class="space-y-1.5 relative">
                                <label
                                    class="block text-[9.5px] uppercase font-black text-slate-455 dark:text-slate-500 tracking-wider pl-1"
                                    >Sisi Tampilan</label
                                >
                                <div class="relative w-full">
                                    <button
                                        @click.stop="
                                            isViewDropdownOpen =
                                                !isViewDropdownOpen;
                                            isModelDropdownOpen = false;
                                        "
                                        class="w-full flex items-center justify-between py-2 px-2.5 rounded-xl border border-sky-100/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-slate-100/60 dark:hover:bg-slate-900/50 transition-all text-xs font-bold text-slate-700 dark:text-slate-355 cursor-pointer outline-none active:scale-[0.98] relative z-25"
                                        type="button"
                                    >
                                        <div
                                            class="flex items-center gap-1.5 min-w-0"
                                        >
                                            <div
                                                class="text-indigo-600 dark:text-indigo-400 flex-shrink-0"
                                            >
                                                <svg
                                                    v-if="
                                                        store.currentView ===
                                                        'front'
                                                    "
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="2.5"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    class="w-3.5 h-3.5"
                                                >
                                                    <path
                                                        d="M9 4a3 3 0 0 0 6 0"
                                                    />
                                                    <path
                                                        d="M9 4H6L3 9h3v11h12V9h3l-3-5h-3"
                                                    />
                                                </svg>
                                                <svg
                                                    v-else-if="
                                                        store.currentView ===
                                                        'back'
                                                    "
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="2.5"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    class="w-3.5 h-3.5"
                                                >
                                                    <path d="M9 4h6" />
                                                    <path
                                                        d="M9 4H6L3 9h3v11h12V9h3l-3-5h-3"
                                                    />
                                                </svg>
                                                <PhEye
                                                    v-else-if="
                                                        store.currentView ===
                                                        'both'
                                                    "
                                                    :size="13"
                                                    weight="bold"
                                                />
                                            </div>
                                            <span
                                                class="truncate text-[10px] font-extrabold uppercase tracking-wide"
                                            >
                                                {{
                                                    store.currentView ===
                                                    "front"
                                                        ? "Depan"
                                                        : store.currentView ===
                                                            "back"
                                                          ? "Belakang"
                                                          : "Preview"
                                                }}
                                            </span>
                                        </div>
                                        <PhCaretDown
                                            :size="10"
                                            weight="bold"
                                            class="text-slate-400 dark:text-slate-500 transition-transform duration-300 flex-shrink-0"
                                            :class="{
                                                'transform rotate-180':
                                                    isViewDropdownOpen,
                                            }"
                                        />
                                    </button>

                                    <!-- Dropdown Menu -->
                                    <Transition name="dropdown">
                                        <div
                                            v-if="isViewDropdownOpen"
                                            class="absolute top-full mt-1.5 left-0 right-0 bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-2xl shadow-xl z-30 p-1.5 space-y-0.5"
                                        >
                                            <button
                                                @click="
                                                    store.currentView = 'front';
                                                    isViewDropdownOpen = false;
                                                "
                                                class="w-full py-1.5 px-2.5 rounded-xl text-left text-[10px] font-bold text-slate-700 dark:text-slate-305 hover:bg-sky-50 dark:hover:bg-slate-850 hover:text-sky-600 dark:hover:text-sky-400 transition-all flex items-center justify-between cursor-pointer border-0 outline-none bg-transparent"
                                                type="button"
                                            >
                                                <div
                                                    class="flex items-center gap-2 min-w-0"
                                                >
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        stroke-width="2.2"
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0"
                                                    >
                                                        <path
                                                            d="M9 4a3 3 0 0 0 6 0"
                                                        />
                                                        <path
                                                            d="M9 4H6L3 9h3v11h12V9h3l-3-5h-3"
                                                        />
                                                    </svg>
                                                    <div class="min-w-0">
                                                        <div
                                                            class="font-extrabold uppercase text-[9px] truncate"
                                                        >
                                                            Tampak Depan
                                                        </div>
                                                        <div
                                                            class="text-[7.5px] text-slate-400 dark:text-slate-500 font-medium truncate"
                                                        >
                                                            Edit Sisi Depan
                                                        </div>
                                                    </div>
                                                </div>
                                                <span
                                                    v-if="
                                                        store.currentView ===
                                                        'front'
                                                    "
                                                    class="text-sky-500 font-extrabold text-[9px] flex-shrink-0"
                                                    >✓</span
                                                >
                                            </button>
                                            <button
                                                @click="
                                                    store.currentView = 'back';
                                                    isViewDropdownOpen = false;
                                                "
                                                class="w-full py-1.5 px-2.5 rounded-xl text-left text-[10px] font-bold text-slate-700 dark:text-slate-355 hover:bg-sky-50 dark:hover:bg-slate-855 hover:text-sky-600 dark:hover:text-sky-400 transition-all flex items-center justify-between cursor-pointer border-0 outline-none bg-transparent"
                                                type="button"
                                            >
                                                <div
                                                    class="flex items-center gap-2 min-w-0"
                                                >
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        stroke-width="2.2"
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0"
                                                    >
                                                        <path d="M9 4h6" />
                                                        <path
                                                            d="M9 4H6L3 9h3v11h12V9h3l-3-5h-3"
                                                        />
                                                    </svg>
                                                    <div class="min-w-0">
                                                        <div
                                                            class="font-extrabold uppercase text-[9px] truncate"
                                                        >
                                                            Tampak Belakang
                                                        </div>
                                                        <div
                                                            class="text-[7.5px] text-slate-400 dark:text-slate-500 font-medium truncate"
                                                        >
                                                            Edit Sisi Belakang
                                                        </div>
                                                    </div>
                                                </div>
                                                <span
                                                    v-if="
                                                        store.currentView ===
                                                        'back'
                                                    "
                                                    class="text-sky-500 font-extrabold text-[9px] flex-shrink-0"
                                                    >✓</span
                                                >
                                            </button>
                                            <button
                                                @click="
                                                    store.currentView = 'both';
                                                    isViewDropdownOpen = false;
                                                "
                                                class="w-full py-1.5 px-2.5 rounded-xl text-left text-[10px] font-bold text-slate-700 dark:text-slate-355 hover:bg-sky-50 dark:hover:bg-slate-855 hover:text-sky-600 dark:hover:text-sky-400 transition-all flex items-center justify-between cursor-pointer border-0 outline-none bg-transparent"
                                                type="button"
                                            >
                                                <div
                                                    class="flex items-center gap-2 min-w-0"
                                                >
                                                    <PhEye
                                                        :size="13"
                                                        weight="bold"
                                                        class="text-slate-400 dark:text-slate-500 flex-shrink-0"
                                                    />
                                                    <div class="min-w-0">
                                                        <div
                                                            class="font-extrabold uppercase text-[9px] truncate"
                                                        >
                                                            Preview
                                                        </div>
                                                        <div
                                                            class="text-[7.5px] text-slate-400 dark:text-slate-500 font-medium truncate"
                                                        >
                                                            Pratinjau Gabungan
                                                        </div>
                                                    </div>
                                                </div>
                                                <span
                                                    v-if="
                                                        store.currentView ===
                                                        'both'
                                                    "
                                                    class="text-sky-500 font-extrabold text-[9px] flex-shrink-0"
                                                    >✓</span
                                                >
                                            </button>
                                        </div>
                                    </Transition>
                                </div>
                            </div>
                        </div>

                        <!-- Ukuran Kaos -->
                        <div class="space-y-2">
                            <div class="flex items-center justify-between">
                                <label
                                    class="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide"
                                    >Pilih Ukuran Kaos:</label
                                >
                                <button
                                    @click="showSizeGuide = true"
                                    class="text-[9px] font-bold text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 transition-all flex items-center gap-1 cursor-pointer bg-transparent border-0 outline-none"
                                    type="button"
                                >
                                    <PhRuler :size="10" weight="bold" />
                                    <span>Panduan Ukuran</span>
                                </button>
                            </div>
                            <div
                                class="grid grid-cols-7 gap-1 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-sky-100 dark:border-slate-800 shadow-inner"
                            >
                                <div
                                    v-for="size in allStandardSizes"
                                    :key="size"
                                    class="relative group"
                                >
                                    <button
                                        @click="
                                            if (isSizeAvailable(size)) {
                                                store.currentSize = size as any;
                                                store.saveToLocalStorage();
                                            }
                                        "
                                        :disabled="!isSizeAvailable(size)"
                                        :class="[
                                            'w-full py-1.5 px-0.5 text-[10px] font-extrabold rounded-lg transition-all duration-300 flex items-center justify-center cursor-pointer',
                                            !isSizeAvailable(size)
                                                ? 'bg-slate-100/50 dark:bg-slate-900/30 text-slate-300 dark:text-slate-600 cursor-not-allowed border border-dashed border-slate-200 dark:border-slate-800'
                                                : store.currentSize === size
                                                  ? 'bg-sky-600 text-white shadow-sm border border-sky-500/10 scale-102 font-black'
                                                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-850/50 hover:scale-105 active:scale-95',
                                        ]"
                                        type="button"
                                    >
                                        {{ size }}
                                    </button>

                                    <!-- Popover gelap untuk ukuran yang tidak diproduksi -->
                                    <div
                                        v-if="!isSizeAvailable(size)"
                                        :class="[
                                            'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-28 p-2 bg-slate-900 dark:bg-slate-800 text-[8.5px] text-slate-200 rounded-xl shadow-lg border border-slate-700/50 pointer-events-none transition-all duration-200 z-50 text-center font-bold tracking-wide leading-tight',
                                            'after:content-[\'\'] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-slate-900 dark:after:border-t-slate-800',
                                            sizeAutoSwitchMsg === size
                                                ? 'opacity-100'
                                                : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                                        ]"
                                    >
                                        Ukuran {{ size }} belum tersedia
                                    </div>
                                </div>
                            </div>

                            <div
                                class="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-sky-50/30 dark:bg-slate-950/20 border border-sky-100/40 dark:border-slate-800/60 rounded-xl text-[9px] text-slate-500 dark:text-slate-400 flex-wrap"
                            >
                                <span
                                    class="font-extrabold text-sky-600 dark:text-sky-400 uppercase"
                                    >Ukuran {{ store.currentSize }}:</span
                                >
                                <span
                                    >Lebar
                                    {{
                                        store.shirtSizes[
                                            store.currentSize as keyof typeof store.shirtSizes
                                        ]?.width || 0
                                    }}
                                    cm</span
                                >
                                <span class="text-slate-350 dark:text-slate-850"
                                    >|</span
                                >
                                <span
                                    >Panjang
                                    {{
                                        store.shirtSizes[
                                            store.currentSize as keyof typeof store.shirtSizes
                                        ]?.length || 0
                                    }}
                                    cm</span
                                >
                                <template v-if="activeSizePrice">
                                    <span
                                        class="text-slate-350 dark:text-slate-850"
                                        >|</span
                                    >
                                    <span
                                        class="font-extrabold text-emerald-600 dark:text-emerald-400"
                                    >
                                        Rp
                                        {{
                                            activeSizePrice.toLocaleString(
                                                "id-ID",
                                            )
                                        }}
                                    </span>
                                </template>
                            </div>
                        </div>

                        <!-- Pilihan Warna Kaos (Consolidated & Non-Repetitive) -->
                        <div class="space-y-3">
                            <div class="flex items-center justify-between">
                                <label
                                    class="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide"
                                    >Pilih Warna Kaos:</label
                                >
                                <span
                                    class="text-[9.5px] font-black text-sky-600 dark:text-sky-400 bg-sky-500/10 dark:bg-sky-400/10 px-2 py-0.5 rounded-lg border border-sky-500/15 dark:border-sky-400/15 uppercase tracking-wider"
                                >
                                    {{ activeColorName }}
                                </span>
                            </div>

                            <!-- Input Pencarian Warna (Hanya muncul jika warna kain banyak) -->
                            <div
                                v-if="activeColors.length > 8"
                                class="relative"
                            >
                                <input
                                    v-model="searchQuery"
                                    type="text"
                                    placeholder="Cari warna kain..."
                                    class="w-full py-1.5 px-3.5 pl-8 text-[10px] font-semibold border border-sky-100 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-slate-50/50 dark:bg-slate-950/50 text-slate-800 dark:text-slate-200 placeholder-slate-400 transition-all duration-200 shadow-inner"
                                />
                                <span
                                    class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2.5"
                                        class="w-3.5 h-3.5"
                                    >
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line
                                            x1="21"
                                            y1="21"
                                            x2="16.65"
                                            y2="16.65"
                                        ></line>
                                    </svg>
                                </span>
                                <button
                                    v-if="searchQuery"
                                    @click="searchQuery = ''"
                                    class="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 cursor-pointer bg-transparent border-0 outline-none"
                                    type="button"
                                >
                                    <PhX :size="10" weight="bold" />
                                </button>
                            </div>

                            <!-- Grid Bubble Warna Kain -->
                            <div
                                class="flex flex-wrap gap-2 items-center bg-slate-50/30 dark:bg-slate-950/15 p-2 rounded-2xl border border-sky-100/40 dark:border-slate-800/40 min-h-[46px]"
                            >
                                <button
                                    v-for="color in filteredColors"
                                    :key="color.hex"
                                    @click="commitColor(color.hex)"
                                    @mouseenter="
                                        previewColor(color.hex, color.name)
                                    "
                                    @mouseleave="restoreColor"
                                    :title="color.name"
                                    :class="[
                                        'w-7 h-7 rounded-full border border-slate-200 dark:border-slate-800 transition-all duration-300 relative hover:scale-120 hover:z-10 focus:outline-none flex items-center justify-center cursor-pointer shadow-sm',
                                        store.shirtColor.toLowerCase() ===
                                        color.hex.toLowerCase()
                                            ? 'ring-2 ring-sky-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-105 shadow-[0_0_12px_rgba(14,165,233,0.35)]'
                                            : 'hover:border-slate-400 dark:hover:border-slate-600',
                                    ]"
                                    :style="{ backgroundColor: color.hex }"
                                    type="button"
                                >
                                    <span
                                        v-if="
                                            store.shirtColor.toLowerCase() ===
                                            color.hex.toLowerCase()
                                        "
                                        :class="[
                                            'text-[9px] font-black',
                                            color.hex.toLowerCase() ===
                                            '#ffffff'
                                                ? 'text-slate-900'
                                                : 'text-white',
                                        ]"
                                        >✓</span
                                    >
                                </button>

                                <div
                                    v-if="filteredColors.length === 0"
                                    class="w-full text-center py-2 text-[10px] text-slate-455 dark:text-slate-500 font-bold"
                                >
                                    Warna "{{ searchQuery }}" tidak ditemukan
                                </div>
                            </div>

                            <!-- Catatan Peninjau / Informasi Warna -->
                            <div
                                class="px-1 text-[9px] text-slate-400 dark:text-slate-500 font-medium flex justify-between items-center leading-normal"
                            >
                                <span
                                    >*Warna hanya preview, tidak 100% sama
                                    dengan kain fisik</span
                                >
                                <span
                                    v-if="
                                        hoveredColorName &&
                                        hoveredColorName !== activeColorName
                                    "
                                    class="text-sky-600 dark:text-sky-400 font-extrabold uppercase text-[8.5px] bg-sky-500/10 dark:bg-sky-400/10 px-1.5 py-0.5 rounded animate-pulse"
                                    >Meninjau: {{ hoveredColorName }}</span
                                >
                            </div>
                        </div>
                    </div>
                </Transition>
            </div>

            <!-- 2. Tambahkan / Edit Teks Accordion -->
            <div
                class="border rounded-2xl overflow-hidden transition-all duration-300 bg-white/40 dark:bg-slate-900/10"
                :class="[
                    isTextOpen && store.currentView !== 'both'
                        ? 'border-sky-200 dark:border-slate-750 bg-white dark:bg-slate-900/30 shadow-[0_4px_20px_-2px_rgba(14,165,233,0.05)]'
                        : 'border-sky-100/60 dark:border-slate-800/80 hover:border-sky-200/60 dark:hover:border-slate-750',
                    {
                        'opacity-40 select-none pointer-events-none':
                            store.currentView === 'both',
                    },
                ]"
            >
                <button
                    @click="isTextOpen = !isTextOpen"
                    :disabled="store.currentView === 'both'"
                    class="w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-300 text-left outline-none select-none"
                    :class="[
                        isTextOpen
                            ? 'bg-sky-50/50 dark:bg-slate-950/40 border-b border-sky-100/60 dark:border-slate-800/80 text-sky-950 dark:text-white font-extrabold'
                            : 'text-slate-700 dark:text-slate-350 hover:bg-slate-50/40 dark:hover:bg-slate-900/50',
                        store.currentView === 'both'
                            ? 'cursor-not-allowed'
                            : 'cursor-pointer',
                    ]"
                    type="button"
                >
                    <div class="flex items-center gap-3">
                        <div
                            :class="[
                                'p-2 rounded-xl transition-all duration-355 ease-out',
                                isTextOpen
                                    ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 scale-110 -rotate-3'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500',
                            ]"
                        >
                            <PhTextT :size="16" weight="bold" />
                        </div>
                        <div>
                            <span
                                class="text-[11px] font-black uppercase tracking-wider block"
                            >
                                {{
                                    isTextSelected
                                        ? "Edit Teks Aktif"
                                        : "Tambahkan Teks"
                                }}
                            </span>
                            <span
                                class="text-[9px] font-medium text-slate-400 dark:text-slate-500 block mt-0.5 max-w-[200px] truncate"
                            >
                                {{
                                    textInput.trim()
                                        ? '"' +
                                          (textInput.length > 20
                                              ? textInput.substring(0, 18) +
                                                "..."
                                              : textInput) +
                                          '"'
                                        : isTextSelected
                                          ? "Teks Terpilih"
                                          : "Tambahkan tulisan ke kaos"
                                }}
                            </span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span
                            v-if="isTextSelected"
                            class="text-[8px] bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-900 px-1.5 py-0.5 rounded-md font-extrabold tracking-wide uppercase"
                            >Terpilih</span
                        >
                        <PhCaretDown
                            :size="14"
                            weight="bold"
                            class="text-slate-400 transition-transform duration-300 mr-1"
                            :class="{
                                'transform rotate-180 text-sky-500': isTextOpen,
                            }"
                        />
                    </div>
                </button>

                <Transition
                    enter-active-class="transition-all duration-300 ease-out"
                    enter-from-class="max-h-0 opacity-0 transform -translate-y-2"
                    enter-to-class="max-h-[800px] opacity-100 transform translate-y-0"
                    leave-active-class="transition-all duration-250 ease-in"
                    leave-from-class="max-h-[800px] opacity-100 transform translate-y-0"
                    leave-to-class="max-h-0 opacity-0 transform -translate-y-2"
                >
                    <div
                        v-show="isTextOpen"
                        class="p-4 bg-white/30 dark:bg-slate-900/10 space-y-4"
                    >
                        <!-- Input Text -->
                        <div class="space-y-1.5">
                            <div class="relative">
                                <span
                                    class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"
                                >
                                    <PhTextT :size="14" weight="bold" />
                                </span>
                                <input
                                    type="text"
                                    v-model="textInput"
                                    @input="handleTextChange"
                                    placeholder="Tulis teks desain Anda..."
                                    class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-white text-slate-800 dark:text-slate-200 placeholder-slate-400 transition-all duration-200"
                                />
                            </div>
                        </div>

                        <!-- Kontrol Styling Teks -->
                        <div class="grid grid-cols-2 gap-3">
                            <!-- Pilihan Font -->
                            <div class="space-y-1">
                                <label
                                    class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wide"
                                    >Jenis Font:</label
                                >
                                <div class="relative">
                                    <select
                                        v-model="textFont"
                                        @change="handleFontChange"
                                        class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-[11px] focus:outline-none focus:border-sky-500 focus:bg-white text-slate-800 dark:text-slate-200 transition-all duration-200 cursor-pointer appearance-none"
                                    >
                                        <option
                                            v-for="font in fontList"
                                            :key="font"
                                            :value="font"
                                            :style="{ fontFamily: font }"
                                            class="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs py-1"
                                        >
                                            {{ font }}
                                        </option>
                                    </select>
                                    <span
                                        class="absolute right-3 inset-y-0 flex items-center pointer-events-none text-slate-400 text-[8px]"
                                        >▼</span
                                    >
                                </div>
                            </div>

                            <!-- Warna Teks -->
                            <div class="space-y-1">
                                <label
                                    class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wide"
                                    >Warna Sablon:</label
                                >
                                <div class="flex gap-2 items-center">
                                    <div
                                        class="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 flex items-center justify-center hover:border-sky-500/50 transition-colors"
                                    >
                                        <input
                                            type="color"
                                            v-model="textColor"
                                            @input="handleColorChange"
                                            class="absolute w-[150%] h-[150%] cursor-pointer border-0 p-0 bg-transparent"
                                        />
                                    </div>
                                    <span
                                        class="text-[10px] uppercase text-slate-600 dark:text-slate-400 font-mono font-bold select-all tracking-wider"
                                        >{{ textColor }}</span
                                    >
                                </div>
                            </div>
                        </div>

                        <!-- Ukuran Font Slider -->
                        <div
                            v-if="isTextSelected"
                            class="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/40"
                        >
                            <div
                                class="flex justify-between text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wide"
                            >
                                <span>Ukuran Teks:</span>
                                <span
                                    class="font-mono text-sky-600 dark:text-sky-400 font-bold"
                                    >{{ fontSize }}px</span
                                >
                            </div>
                            <input
                                type="range"
                                v-model.number="fontSize"
                                @input="handleFontSizeChange"
                                min="12"
                                max="120"
                                step="1"
                                class="w-full accent-sky-600 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-lg cursor-pointer transition-all"
                            />
                        </div>

                        <!-- Tombol Aksi -->
                        <div class="flex gap-2">
                            <button
                                @click="handleAddText"
                                :disabled="!textInput.trim()"
                                class="flex-grow py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white font-bold text-xs transition-all duration-300 flex items-center justify-center gap-1.5 border border-sky-500/10 shadow-sm active:scale-[0.98] cursor-pointer"
                                type="button"
                            >
                                <PhPlus :size="12" weight="bold" />
                                <span>{{
                                    isTextSelected
                                        ? "Duplikat Baru"
                                        : "Tambahkan Teks"
                                }}</span>
                            </button>
                            <button
                                v-if="isTextSelected"
                                @click="emit('deselect-object')"
                                class="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-350 border border-slate-200 dark:border-slate-750 transition-all font-bold text-xs shadow-sm active:scale-98 cursor-pointer"
                                title="Selesai Edit"
                                type="button"
                            >
                                Selesai
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>

            <!-- 3. Unggah Gambar Accordion -->
            <div
                class="border rounded-2xl overflow-hidden transition-all duration-300 bg-white/40 dark:bg-slate-900/10"
                :class="[
                    isUploadOpen && store.currentView !== 'both'
                        ? 'border-sky-200 dark:border-slate-750 bg-white dark:bg-slate-900/30 shadow-[0_4px_20px_-2px_rgba(14,165,233,0.05)]'
                        : 'border-sky-100/60 dark:border-slate-800/80 hover:border-sky-200/60 dark:hover:border-slate-750',
                    {
                        'opacity-40 select-none pointer-events-none':
                            store.currentView === 'both',
                    },
                ]"
            >
                <button
                    @click="isUploadOpen = !isUploadOpen"
                    :disabled="store.currentView === 'both'"
                    class="w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-300 text-left outline-none select-none"
                    :class="[
                        isUploadOpen
                            ? 'bg-sky-50/50 dark:bg-slate-950/40 border-b border-sky-100/60 dark:border-slate-800/80 text-sky-950 dark:text-white font-extrabold'
                            : 'text-slate-700 dark:text-slate-350 hover:bg-slate-50/40 dark:hover:bg-slate-900/50',
                        store.currentView === 'both'
                            ? 'cursor-not-allowed'
                            : 'cursor-pointer',
                    ]"
                    type="button"
                >
                    <div class="flex items-center gap-3">
                        <div
                            :class="[
                                'p-2 rounded-xl transition-all duration-355 ease-out',
                                isUploadOpen
                                    ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 scale-110 -translate-y-0.5'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500',
                            ]"
                        >
                            <PhUploadSimple :size="16" weight="bold" />
                        </div>
                        <div>
                            <span
                                class="text-[11px] font-black uppercase tracking-wider block"
                                >Unggah Gambar</span
                            >
                            <span
                                class="text-[9px] font-medium text-slate-400 dark:text-slate-500 block mt-0.5"
                            >
                                {{
                                    store.uploadedImages.length > 0
                                        ? store.uploadedImages.length +
                                          " gambar di cache"
                                        : "Unggah logo atau cetakan sablon"
                                }}
                            </span>
                        </div>
                    </div>
                    <PhCaretDown
                        :size="14"
                        weight="bold"
                        class="text-slate-400 transition-transform duration-300 mr-1"
                        :class="{
                            'transform rotate-180 text-sky-500': isUploadOpen,
                        }"
                    />
                </button>

                <Transition
                    enter-active-class="transition-all duration-300 ease-out"
                    enter-from-class="max-h-0 opacity-0 transform -translate-y-2"
                    enter-to-class="max-h-[800px] opacity-100 transform translate-y-0"
                    leave-active-class="transition-all duration-250 ease-in"
                    leave-from-class="max-h-[800px] opacity-100 transform translate-y-0"
                    leave-to-class="max-h-0 opacity-0 transform -translate-y-2"
                >
                    <div
                        v-show="isUploadOpen"
                        class="p-4 bg-white/30 dark:bg-slate-900/10 space-y-4"
                    >
                        <div
                            @dragover="onDragOver"
                            @dragleave="onDragLeave"
                            @drop="onDrop"
                            :class="[
                                'border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 bg-slate-50/50 dark:bg-slate-950/20 relative group',
                                isDragActive
                                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 shadow-[0_0_15px_rgba(14,165,233,0.15)]'
                                    : 'border-sky-200 dark:border-slate-800 hover:border-sky-400 hover:bg-sky-50/30 dark:hover:bg-slate-950/30',
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
                            <PhUploadSimple
                                class="h-7 w-7 text-slate-400 group-hover:text-sky-500 transition-colors duration-300 mb-1.5 group-hover:animate-bounce"
                                :size="24"
                                weight="bold"
                            />
                            <span
                                class="text-[11px] font-bold text-slate-700 dark:text-slate-300 text-center"
                                >Klik / Seret Logo ke Sini</span
                            >
                            <span class="text-[9px] text-slate-400 mt-0.5"
                                >PNG, JPG, SVG maks 10MB</span
                            >
                        </div>

                        <div
                            v-if="uploadError"
                            class="text-[9px] font-semibold text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 py-2 px-3 rounded-xl flex items-center gap-1.5 shadow-sm"
                        >
                            <span
                                class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"
                            ></span>
                            {{ uploadError }}
                        </div>

                        <!-- Galeri Cache Gambar -->
                        <div
                            v-if="store.uploadedImages.length > 0"
                            class="space-y-2 pt-1"
                        >
                            <label
                                class="block text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-wider"
                                >Desain diunggah:</label
                            >
                            <div class="grid grid-cols-3 gap-2">
                                <div
                                    v-for="img in store.uploadedImages"
                                    :key="img.id"
                                    class="relative group/thumb border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 h-14 cursor-pointer hover:border-sky-500/60 hover:shadow-lg transition-all duration-300 flex items-center justify-center"
                                    @click="emit('add-image', img.dataUrl)"
                                    :title="`Klik untuk menambahkan ke kaos. Ukuran: ${formatBytes(img.size)}`"
                                >
                                    <img
                                        :src="img.dataUrl"
                                        class="w-full h-full object-contain p-1.5"
                                    />
                                    <div
                                        class="absolute inset-0 bg-sky-950/80 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-300 flex flex-col justify-center items-center text-[7px] text-sky-100 p-0.5 text-center"
                                    >
                                        <span
                                            class="font-black text-sky-300 tracking-wider"
                                            >KOMPRES</span
                                        >
                                        <span
                                            class="font-bold font-mono mt-0.5"
                                            >{{ formatBytes(img.size) }}</span
                                        >
                                    </div>
                                    <button
                                        @click.stop="openCropForUpload(img)"
                                        class="absolute top-1 left-1 bg-sky-50/90 dark:bg-slate-900/90 border border-sky-200 dark:border-slate-800 p-1.5 rounded-lg text-sky-600 dark:text-sky-400 hover:bg-sky-100 transition-all opacity-100 lg:opacity-0 lg:group-hover/thumb:opacity-100 z-10 shadow-sm"
                                        type="button"
                                        title="Potong Gambar (Crop)"
                                    >
                                        <PhCrop :size="12" />
                                    </button>

                                    <button
                                        @click.stop="
                                            store.removeUploadedImage(img.id)
                                        "
                                        class="absolute top-1 right-1 bg-red-50/90 dark:bg-slate-900/90 border border-red-200 dark:border-slate-800 p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-100 transition-all opacity-100 lg:opacity-0 lg:group-hover/thumb:opacity-100 z-10 shadow-sm"
                                        type="button"
                                    >
                                        <PhTrash :size="12" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Transition>
            </div>

            <!-- 4. Latar Belakang Mockup Accordion -->
            <div
                class="border rounded-2xl overflow-hidden transition-all duration-300 bg-white/40 dark:bg-slate-900/10"
                :class="[
                    isBackdropOpen
                        ? 'border-sky-200 dark:border-slate-750 bg-white dark:bg-slate-900/30 shadow-[0_4px_20px_-2px_rgba(14,165,233,0.05)]'
                        : 'border-sky-100/60 dark:border-slate-800/80 hover:border-sky-200/60 dark:hover:border-slate-750',
                ]"
            >
                <button
                    @click="isBackdropOpen = !isBackdropOpen"
                    class="w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-300 text-left cursor-pointer outline-none select-none"
                    :class="[
                        isBackdropOpen
                            ? 'bg-sky-50/50 dark:bg-slate-950/40 border-b border-sky-100/60 dark:border-slate-800/80 text-sky-950 dark:text-white font-extrabold'
                            : 'text-slate-700 dark:text-slate-350 hover:bg-slate-50/40 dark:hover:bg-slate-900/50',
                    ]"
                    type="button"
                >
                    <div class="flex items-center gap-3">
                        <div
                            :class="[
                                'p-2 rounded-xl transition-all duration-355 ease-out',
                                isBackdropOpen
                                    ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 scale-110 rotate-12'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500',
                            ]"
                        >
                            <PhPalette :size="16" weight="bold" />
                        </div>
                        <div>
                            <span
                                class="text-[11px] font-black uppercase tracking-wider block"
                                >Latar Belakang</span
                            >
                            <span
                                class="text-[9px] font-medium text-slate-400 dark:text-slate-500 block mt-0.5"
                            >
                                {{
                                    store.backdropType === "solid"
                                        ? "Warna Solid"
                                        : store.backdropType === "checkerboard"
                                          ? "Catur Transparan"
                                          : store.backdropType === "gradient"
                                            ? "Studio"
                                            : "Foto Kustom"
                                }}
                            </span>
                        </div>
                    </div>
                    <PhCaretDown
                        :size="14"
                        weight="bold"
                        class="text-slate-400 transition-transform duration-300 mr-1"
                        :class="{
                            'transform rotate-180 text-sky-500': isBackdropOpen,
                        }"
                    />
                </button>

                <Transition
                    enter-active-class="transition-all duration-300 ease-out"
                    enter-from-class="max-h-0 opacity-0 transform -translate-y-2"
                    enter-to-class="max-h-[800px] opacity-100 transform translate-y-0"
                    leave-active-class="transition-all duration-250 ease-in"
                    leave-from-class="max-h-[800px] opacity-100 transform translate-y-0"
                    leave-to-class="max-h-0 opacity-0 transform -translate-y-2"
                >
                    <div
                        v-show="isBackdropOpen"
                        class="p-4 bg-white/30 dark:bg-slate-900/10 space-y-4"
                    >
                        <!-- Jenis Latar Belakang -->
                        <div
                            class="grid grid-cols-4 gap-1.5 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-sky-100 dark:border-slate-800"
                        >
                            <button
                                v-for="type in [
                                    'solid',
                                    'checkerboard',
                                    'gradient',
                                    'custom',
                                ] as const"
                                :key="type"
                                @click="store.backdropType = type"
                                :class="[
                                    'py-1.5 px-0.5 text-[9px] font-black rounded-lg capitalize transition-all duration-300 flex flex-col items-center justify-center gap-1 cursor-pointer',
                                    store.backdropType === type
                                        ? 'bg-sky-600 text-white shadow shadow-sky-500/15 border border-sky-500/10'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/40',
                                ]"
                                type="button"
                            >
                                <PhPaintBrush
                                    v-if="type === 'solid'"
                                    :size="12"
                                    weight="bold"
                                />
                                <PhGridFour
                                    v-else-if="type === 'checkerboard'"
                                    :size="12"
                                    weight="bold"
                                />
                                <PhSparkle
                                    v-else-if="type === 'gradient'"
                                    :size="12"
                                    weight="bold"
                                />
                                <PhImage
                                    v-else-if="type === 'custom'"
                                    :size="12"
                                    weight="bold"
                                />
                                <span>{{
                                    type === "solid"
                                        ? "Warna"
                                        : type === "checkerboard"
                                          ? "Catur"
                                          : type === "gradient"
                                            ? "Studio"
                                            : "Foto"
                                }}</span>
                            </button>
                        </div>

                        <!-- Solid Color Picker -->
                        <div
                            v-if="store.backdropType === 'solid'"
                            class="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-sky-100 dark:border-slate-800"
                        >
                            <span
                                class="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide"
                                >Warna Latar:</span
                            >
                            <div class="flex gap-2.5 items-center">
                                <div
                                    class="relative w-7 h-7 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-850 bg-slate-100 flex items-center justify-center hover:border-sky-500/50 transition-colors"
                                >
                                    <input
                                        type="color"
                                        :value="store.backdropColor"
                                        @input="
                                            (e) =>
                                                (store.backdropColor = (
                                                    e.target as HTMLInputElement
                                                ).value)
                                        "
                                        class="absolute w-[150%] h-[150%] cursor-pointer border-0 p-0 bg-transparent"
                                    />
                                </div>
                                <span
                                    class="text-[10px] font-mono uppercase text-slate-700 dark:text-slate-300 font-bold tracking-wider"
                                    >{{ store.backdropColor }}</span
                                >
                                <button
                                    @click="store.backdropColor = '#0f172a'"
                                    class="text-[8px] font-bold uppercase tracking-wider py-1 px-2.5 border border-slate-200 dark:border-slate-700 hover:border-slate-350 dark:hover:border-slate-650 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-450 transition-colors"
                                    type="button"
                                >
                                    Reset
                                </button>
                            </div>
                        </div>

                        <!-- Custom Image Backdrop -->
                        <div
                            v-if="store.backdropType === 'custom'"
                            class="space-y-3"
                        >
                            <div
                                @click="triggerBackdropFileInput"
                                class="border border-dashed border-sky-200 dark:border-slate-800 hover:border-sky-300 hover:bg-sky-50/40 dark:hover:bg-slate-950/20 bg-slate-50 dark:bg-slate-950 rounded-xl p-3.5 flex flex-col items-center justify-center cursor-pointer transition-colors group"
                            >
                                <input
                                    type="file"
                                    ref="backdropFileInput"
                                    @change="handleBackdropUpload"
                                    accept="image/*"
                                    class="hidden"
                                />
                                <PhImage
                                    class="text-slate-400 group-hover:text-sky-500 transition-colors mb-1"
                                    :size="16"
                                    weight="bold"
                                />
                                <span
                                    class="text-[9px] font-bold text-slate-700 dark:text-slate-300"
                                    >Pilih Foto Latar Belakang</span
                                >
                                <span class="text-[8px] text-slate-400 mt-0.5"
                                    >Lantai kayu, gantungan, atau dekorasi</span
                                >
                            </div>
                            <div
                                v-if="store.customBackdropUrl"
                                class="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-sky-100 dark:border-slate-800"
                            >
                                <div class="flex items-center gap-2">
                                    <img
                                        :src="store.customBackdropUrl"
                                        class="w-7 h-7 object-cover rounded-lg border border-slate-200 dark:border-slate-800"
                                    />
                                    <span
                                        class="text-[9px] font-bold text-slate-500 dark:text-slate-400"
                                        >Gambar terpasang</span
                                    >
                                </div>
                                <button
                                    @click="store.customBackdropUrl = null"
                                    class="text-[9px] font-bold text-red-600 hover:text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/40 px-2 py-1 rounded-lg transition-all"
                                    type="button"
                                >
                                    Hapus
                                </button>
                            </div>
                        </div>
                    </div>
                </Transition>
            </div>

            <!-- 5. Ekspor Hasil Desain Accordion -->
            <div
                class="border rounded-2xl transition-all duration-300 bg-white/40 dark:bg-slate-900/10"
                :class="[
                    isExportOpen
                        ? 'border-sky-200 dark:border-slate-750 bg-white dark:bg-slate-900/30 shadow-[0_4px_20px_-2px_rgba(14,165,233,0.05)]'
                        : 'border-sky-100/60 dark:border-slate-800/80 hover:border-sky-200/60 dark:hover:border-slate-750',
                    { 'overflow-hidden': !isExportFullyOpen },
                ]"
            >
                <button
                    @click="isExportOpen = !isExportOpen"
                    class="w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-300 text-left cursor-pointer outline-none select-none"
                    :class="[
                        isExportOpen
                            ? 'bg-sky-50/50 dark:bg-slate-950/40 border-b border-sky-100/60 dark:border-slate-800/80 text-sky-950 dark:text-white font-extrabold'
                            : 'text-slate-700 dark:text-slate-350 hover:bg-slate-50/40 dark:hover:bg-slate-900/50',
                    ]"
                    type="button"
                >
                    <div class="flex items-center gap-3">
                        <div
                            :class="[
                                'p-2 rounded-xl transition-all duration-355 ease-out',
                                isExportOpen
                                    ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 scale-110 translate-y-0.5'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500',
                            ]"
                        >
                            <PhDownloadSimple :size="16" weight="bold" />
                        </div>
                        <div>
                            <span
                                class="text-[11px] font-black uppercase tracking-wider block"
                                >Ekspor Desain</span
                            >
                            <span
                                class="text-[9px] font-medium text-slate-400 dark:text-slate-500 block mt-0.5"
                            >
                                Simpan sablon transparan atau mockup gambar PNG
                            </span>
                        </div>
                    </div>
                    <PhCaretDown
                        :size="14"
                        weight="bold"
                        class="text-slate-400 transition-transform duration-300 mr-1"
                        :class="{
                            'transform rotate-180 text-sky-500': isExportOpen,
                        }"
                    />
                </button>

                <Transition
                    enter-active-class="transition-all duration-300 ease-out"
                    enter-from-class="max-h-0 opacity-0 transform -translate-y-2"
                    enter-to-class="max-h-[800px] opacity-100 transform translate-y-0"
                    leave-active-class="transition-all duration-250 ease-in"
                    leave-from-class="max-h-[800px] opacity-100 transform translate-y-0"
                    leave-to-class="max-h-0 opacity-0 transform -translate-y-2"
                    @after-enter="isExportFullyOpen = true"
                    @before-leave="isExportFullyOpen = false"
                >
                    <div
                        v-show="isExportOpen"
                        class="p-4 bg-white/30 dark:bg-slate-900/10 space-y-4"
                    >
                        <div class="grid grid-cols-2 gap-3 relative">
                            <!-- Overlay click-away -->
                            <div
                                v-if="
                                    isPrintDropdownOpen || isMockupDropdownOpen
                                "
                                @click="
                                    isPrintDropdownOpen = false;
                                    isMockupDropdownOpen = false;
                                "
                                class="fixed inset-0 z-10 cursor-default bg-transparent"
                            ></div>

                            <!-- Unduh Sablon -->
                            <div class="relative">
                                <button
                                    @click.stop="
                                        isPrintDropdownOpen =
                                            !isPrintDropdownOpen
                                    "
                                    class="w-full py-2.5 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all duration-300 flex flex-col items-center justify-center gap-1 border border-slate-200 dark:border-slate-700 hover:border-slate-350 shadow-sm active:scale-[0.98] group cursor-pointer"
                                    type="button"
                                >
                                    <PhFloppyDisk
                                        class="text-slate-500 dark:text-slate-450 group-hover:text-slate-750 transition-colors"
                                        :size="16"
                                        weight="bold"
                                    />
                                    <div
                                        class="flex flex-col items-center text-center"
                                    >
                                        <span class="text-[10px]"
                                            >Unduh Sablon</span
                                        >
                                        <span
                                            class="text-[7.5px] text-slate-500 dark:text-slate-400 font-medium mt-0.5"
                                            >PNG Transparan</span
                                        >
                                    </div>
                                </button>

                                <Transition name="dropdown-up">
                                    <div
                                        v-if="isPrintDropdownOpen"
                                        class="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-2xl shadow-xl z-20 py-1.5 overflow-hidden flex flex-col text-left"
                                    >
                                        <button
                                            @click="handlePrintExport('front')"
                                            class="px-3.5 py-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800 hover:text-sky-600 transition-all text-left flex items-center gap-1.5 cursor-pointer"
                                            type="button"
                                        >
                                            <span
                                                class="w-1.5 h-1.5 rounded-full bg-sky-500"
                                            ></span>
                                            Tampak Depan
                                        </button>
                                        <button
                                            @click="handlePrintExport('back')"
                                            class="px-3.5 py-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800 hover:text-sky-600 transition-all text-left flex items-center gap-1.5 cursor-pointer"
                                            type="button"
                                        >
                                            <span
                                                class="w-1.5 h-1.5 rounded-full bg-sky-500"
                                            ></span>
                                            Tampak Belakang
                                        </button>
                                        <div
                                            class="h-[1px] bg-sky-100/50 dark:bg-slate-800 my-1"
                                        ></div>
                                        <button
                                            @click="handlePrintExport('both')"
                                            class="px-3.5 py-2 text-[10px] font-extrabold text-sky-600 dark:text-sky-400 hover:bg-sky-600 dark:hover:bg-sky-600 hover:text-white transition-all text-left flex items-center gap-1.5 cursor-pointer"
                                            type="button"
                                        >
                                            <PhSparkle
                                                :size="10"
                                                weight="bold"
                                            />
                                            Depan + Belakang
                                        </button>
                                    </div>
                                </Transition>
                            </div>

                            <!-- Unduh Mockup -->
                            <div class="relative">
                                <button
                                    @click.stop="
                                        isMockupDropdownOpen =
                                            !isMockupDropdownOpen
                                    "
                                    class="w-full py-2.5 px-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-all duration-300 flex flex-col items-center justify-center gap-1 border border-sky-500/10 shadow-sm active:scale-[0.98] group cursor-pointer"
                                    type="button"
                                >
                                    <PhImage
                                        class="text-sky-100 group-hover:text-white transition-colors"
                                        :size="16"
                                        weight="bold"
                                    />
                                    <div
                                        class="flex flex-col items-center text-center"
                                    >
                                        <span class="text-[10px]"
                                            >Unduh Mockup</span
                                        >
                                        <span
                                            class="text-[7.5px] text-sky-100/90 font-medium mt-0.5"
                                            >Mockup Kaos PNG</span
                                        >
                                    </div>
                                </button>

                                <Transition name="dropdown-up">
                                    <div
                                        v-if="isMockupDropdownOpen"
                                        class="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-2xl shadow-xl z-20 py-1.5 overflow-hidden flex flex-col text-left"
                                    >
                                        <button
                                            @click="handleMockupExport('front')"
                                            class="px-3.5 py-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800 hover:text-sky-600 transition-all text-left flex items-center gap-1.5 cursor-pointer"
                                            type="button"
                                        >
                                            <span
                                                class="w-1.5 h-1.5 rounded-full bg-sky-500"
                                            ></span>
                                            Tampak Depan
                                        </button>
                                        <button
                                            @click="handleMockupExport('back')"
                                            class="px-3.5 py-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800 hover:text-sky-600 transition-all text-left flex items-center gap-1.5 cursor-pointer"
                                            type="button"
                                        >
                                            <span
                                                class="w-1.5 h-1.5 rounded-full bg-sky-500"
                                            ></span>
                                            Tampak Belakang
                                        </button>
                                        <div
                                            class="h-[1px] bg-sky-100/50 dark:bg-slate-800 my-1"
                                        ></div>
                                        <button
                                            @click="handleMockupExport('both')"
                                            class="px-3.5 py-2 text-[10px] font-extrabold text-sky-600 dark:text-sky-400 hover:bg-sky-600 dark:hover:bg-sky-600 hover:text-white transition-all text-left flex items-center gap-1.5 cursor-pointer"
                                            type="button"
                                        >
                                            <PhSparkle
                                                :size="10"
                                                weight="bold"
                                            />
                                            Depan + Belakang
                                        </button>
                                    </div>
                                </Transition>
                            </div>
                        </div>
                    </div>
                </Transition>
            </div>
        </div>

        <!-- Pesan Info Mode Preview (Hanya tampil saat mode 'both') -->
        <div
            v-if="store.currentView === 'both'"
            class="p-4 bg-sky-50/70 dark:bg-slate-950/40 border border-sky-100 dark:border-slate-800 rounded-2xl text-center space-y-2 shadow-sm animate-in fade-in duration-300"
        >
            <div
                class="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto shadow-sm"
            >
                <PhSparkle :size="16" weight="bold" class="animate-pulse" />
            </div>
            <h4 class="font-extrabold text-xs text-sky-950 dark:text-sky-300">
                Mode Preview Kedua Sisi
            </h4>
            <p
                class="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed"
            >
                Anda melihat tampilan depan & belakang sekaligus. Untuk
                memanipulasi sablon, silakan pilih sisi
                <strong>Depan</strong> atau <strong>Belakang</strong> pada tab
                "Konfigurasi Kaos" di atas.
            </p>
        </div>

        <!-- Modal Panduan Ukuran Kaos (Premium Pop-Up) -->
        <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
        >
            <div
                v-if="showSizeGuide"
                class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
                @click.self="showSizeGuide = false"
            >
                <div
                    class="bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-modal-pop text-slate-850 dark:text-slate-100"
                >
                    <!-- Modal Header -->
                    <div
                        class="px-4 py-3 border-b border-sky-50 dark:border-slate-800 flex justify-between items-center bg-sky-50/50 dark:bg-slate-950/20"
                    >
                        <div class="flex items-center gap-2">
                            <PhRuler
                                :size="14"
                                class="text-sky-600 dark:text-sky-400"
                                weight="bold"
                            />
                            <h3
                                class="font-extrabold text-[11px] tracking-tight text-slate-900 dark:text-white uppercase"
                            >
                                Panduan Ukuran
                            </h3>
                        </div>
                        <button
                            @click="showSizeGuide = false"
                            class="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all cursor-pointer bg-transparent border-0 outline-none"
                        >
                            <PhX :size="12" weight="bold" />
                        </button>
                    </div>

                    <!-- Modal Body -->
                    <div class="p-4 space-y-3">
                        <!-- Grid Layout: Tabel (Kiri) & Gambar Chart (Kanan) -->
                        <div class="grid grid-cols-2 gap-3 items-center">
                            <!-- Tabel Ukuran -->
                            <div
                                class="overflow-hidden border border-sky-100 dark:border-slate-800 rounded-xl"
                            >
                                <table
                                    class="w-full text-[9.5px] text-left border-collapse"
                                >
                                    <thead>
                                        <tr
                                            class="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-extrabold uppercase border-b border-sky-100 dark:border-slate-800"
                                        >
                                            <th class="px-2 py-1.5 text-center">
                                                Size
                                            </th>
                                            <th class="px-2 py-1.5 text-center">
                                                L (cm)
                                            </th>
                                            <th class="px-2 py-1.5 text-center">
                                                P (cm)
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
                                            v-for="(
                                                dims, size
                                            ) in store.shirtSizes"
                                            :key="size"
                                            class="border-b border-sky-50/50 dark:border-slate-800 last:border-0 hover:bg-sky-50/20 dark:hover:bg-slate-850/30 transition-all"
                                            :class="{
                                                'bg-sky-50/40 dark:bg-sky-950/20 font-bold text-sky-600 dark:text-sky-400':
                                                    store.currentSize === size,
                                            }"
                                        >
                                            <td
                                                class="px-2 py-1 text-center font-black"
                                            >
                                                {{ size }}
                                            </td>
                                            <td class="px-2 py-1 text-center">
                                                {{ dims.width }}
                                            </td>
                                            <td class="px-2 py-1 text-center">
                                                {{ dims.length }}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <!-- Gambar Size Chart -->
                            <div
                                class="flex items-center justify-center p-1.5 bg-slate-50 dark:bg-slate-950/45 rounded-xl border border-sky-100/50 dark:border-slate-800/85 h-full min-h-[140px]"
                            >
                                <img
                                    :src="sizeChartImg"
                                    alt="Size Chart"
                                    class="max-w-full max-h-[130px] object-contain rounded-lg filter dark:brightness-95"
                                />
                            </div>
                        </div>

                        <!-- Keterangan Singkat Cara Mengukur & Toleransi -->
                        <div
                            class="bg-sky-50/30 dark:bg-slate-950/20 border border-sky-100/50 dark:border-slate-800/80 p-2.5 rounded-xl text-[8.5px] text-slate-500 dark:text-slate-400 leading-normal space-y-1"
                        >
                            <div>
                                * <strong>Lebar (L):</strong> Jahitan ketiak
                                kiri ke ketiak kanan.
                            </div>
                            <div>
                                * <strong>Panjang (P):</strong> Bahu tertinggi
                                hingga ujung bawah kaos.
                            </div>
                            <div
                                class="text-amber-600 dark:text-amber-400 font-bold"
                            >
                                * Toleransi penyusutan/jahitan ±1 s/d 2 cm.
                            </div>
                        </div>
                    </div>

                    <!-- Modal Footer -->
                    <div
                        class="px-4 py-2.5 border-t border-sky-50 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-950/10"
                    >
                        <button
                            @click="showSizeGuide = false"
                            class="px-3.5 py-1.5 text-[9.5px] font-extrabold bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow transition-all duration-300 hover:scale-103 cursor-pointer border-0 outline-none"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- Modal Pemotong Gambar -->
        <ImageCropperModal
            :show="isCropModalOpen"
            :image-url="imageToCropUrl"
            @close="isCropModalOpen = false"
            @crop="handleCropComplete"
        />
    </div>
</template>

<style scoped>
/* Transisi halus slider */
input[type="range"]::-webkit-slider-thumb {
    box-shadow: 0 0 10px rgba(14, 165, 233, 0.4);
    border: 1.5px solid rgba(255, 255, 255, 0.8);
}

/* Animasi Transisi Dropdown Baru */
.dropdown-enter-active,
.dropdown-leave-active {
    transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.dropdown-enter-from,
.dropdown-leave-to {
    opacity: 0;
    transform: translateY(-8px) scale(0.96);
}

.dropdown-up-enter-active,
.dropdown-up-leave-active {
    transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.dropdown-up-enter-from,
.dropdown-up-leave-to {
    opacity: 0;
    transform: translateY(8px) scale(0.96);
}
</style>
