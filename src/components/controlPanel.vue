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
} from "@phosphor-icons/vue";

import { compressImage, formatBytes } from "../utils/imageCompressor";
import sizeChartImg from "../assets/images/size chart.png";

const props = defineProps<{
    selectedObject: any;
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
    (e: "deselect-object"): void;
}>();

const store = useConfiguratorStore();
const showSizeGuide = ref(false);

// State Dropdown Ekspor
const activeDropdown = ref<"print" | "mockup" | null>(null);
const toggleDropdown = (type: "print" | "mockup") => {
    if (activeDropdown.value === type) {
        activeDropdown.value = null;
    } else {
        activeDropdown.value = type;
    }
};
const handlePrintExport = (view: "front" | "back" | "both") => {
    emit("export-print", view);
    activeDropdown.value = null;
};
const handleMockupExport = (view: "front" | "back" | "both") => {
    emit("export-mockup", view);
    activeDropdown.value = null;
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

// Preset warna kaos terlaris perusahaan (akses cepat)
const presetColors = [
    { name: "PUTIH", hex: "#ffffff" },
    { name: "HITAM", hex: "#000000" },
    { name: "ABU MISTY", hex: "#dcdcdc" },
    { name: "NAVY/DONGKER", hex: "#0f172a" },
    { name: "MERAH", hex: "#e60012" },
    { name: "BENHUR", hex: "#1c4c96" },
    { name: "TURKIS", hex: "#00a6b4" },
    { name: "KUNING", hex: "#ffff00" },
];

// Daftar lengkap warna yang tersedia di perusahaan
const companyColors = [
    { name: "WOODROSE", hex: "#c39c9f" },
    { name: "BENHUR", hex: "#1c4c96" },
    { name: "UNGU VARIASI PUTIH", hex: "#7a2f8f" },
    { name: "UNGU VARIASI ABU", hex: "#6c337a" },
    { name: "UNGU TUA", hex: "#4a154b" },
    { name: "UNGU PASTEL", hex: "#b39ddb" },
    { name: "UNGU MUDA", hex: "#dfb2f4" },
    { name: "UNGU", hex: "#800080" },
    { name: "TWOTON", hex: "#5c6b73" },
    { name: "TURKISH TUA", hex: "#005d7f" },
    { name: "TURKISH MUDA", hex: "#00a8cc" },
    { name: "TURKIS-BATA", hex: "#008290" },
    { name: "TURKIS SEDANG", hex: "#008ba3" },
    { name: "TURKIS HITAM", hex: "#003f4f" },
    { name: "TURKIS", hex: "#00a6b4" },
    { name: "TOSCA-NAVY", hex: "#005a70" },
    { name: "TOSCA TUA", hex: "#005c53" },
    { name: "TOSCA SEDANG", hex: "#008080" },
    { name: "TOSCA MUDA", hex: "#b2ebf2" },
    { name: "TOSCA", hex: "#008080" },
    { name: "TOFFEE", hex: "#8b5a2b" },
    { name: "TERACOTA", hex: "#c35237" },
    { name: "STONE GREY", hex: "#808a8a" },
    { name: "STONE GREEN", hex: "#506c64" },
    { name: "STILL BLUE", hex: "#5f859b" },
    { name: "SKY BLUE", hex: "#87ceeb" },
    { name: "SEA GREEN", hex: "#2e8b57" },
    { name: "SALEM", hex: "#f89b7d" },
    { name: "SAGA", hex: "#488b49" },
    { name: "RUBY RED", hex: "#9b111e" },
    { name: "ROSE", hex: "#ff007f" },
    { name: "RED", hex: "#ff0000" },
    { name: "PUTIH-WOODROSE", hex: "#f9f5f5" },
    { name: "PUTIH-TURKIS", hex: "#f0fafb" },
    { name: "PUTIH-TOSCA", hex: "#f0fafa" },
    { name: "PUTIH-PINK", hex: "#fff5f6" },
    { name: "PUTIH-ORANGE TOSCA", hex: "#fdf8f4" },
    { name: "PUTIH-ORANGE", hex: "#fffcf9" },
    { name: "PUTIH-NAVY", hex: "#f4f6fa" },
    { name: "PUTIH-MARUN", hex: "#fdf4f5" },
    { name: "PUTIH-HITAM", hex: "#fbfbfb" },
    { name: "PUTIH-HIJAU", hex: "#f5fbf6" },
    { name: "PUTIH-COKLAT", hex: "#fbf9f6" },
    { name: "PUTIH-ABU", hex: "#fafafa" },
    { name: "PUTIH VARIASI MERAH", hex: "#fff9f9" },
    { name: "PUTIH VARIASI BENHUR", hex: "#f9fbfd" },
    { name: "PUTIH VAR MRN-BENHUR", hex: "#fbfafc" },
    { name: "PUTIH TULANG", hex: "#fbf6eb" },
    { name: "PUTIH", hex: "#ffffff" },
    { name: "PINK SEDANG", hex: "#ff69b4" },
    { name: "PINK MUDA", hex: "#ffb6c1" },
    { name: "PINK FANTA", hex: "#f50057" },
    { name: "PINK DUSTY", hex: "#dcaeac" },
    { name: "PINK DOVE", hex: "#e0b0b0" },
    { name: "PINK", hex: "#ffc0cb" },
    { name: "PICH", hex: "#fcd6b8" },
    { name: "PALE PEACH", hex: "#ffdfd3" },
    { name: "ORANGE-PUTIH", hex: "#ffa500" },
    { name: "ORANGE-KHEKY", hex: "#e59400" },
    { name: "ORANGE-ABU", hex: "#f07f28" },
    { name: "ORANGE BATA-HITAM", hex: "#b33c1b" },
    { name: "ORANGE BATA", hex: "#cc4e2b" },
    { name: "ORANGE", hex: "#ff8c00" },
    { name: "OLIVE GREEN", hex: "#bab86c" },
    { name: "OLD SEAGREEN", hex: "#1b4d3e" },
    { name: "OLD GRAPE NECTAR", hex: "#5c2e43" },
    { name: "OLD DEEPBLUE", hex: "#0f2b46" },
    { name: "OLD ABU MISTY", hex: "#a8a8a8" },
    { name: "OFFWHITE", hex: "#faf9f6" },
    { name: "OCEAN BLUE", hex: "#006994" },
    { name: "NAVY/DONGKER", hex: "#0f172a" },
    { name: "NAVY-PUTIH", hex: "#131e35" },
    { name: "NAVY-KUNYIT", hex: "#1c2840" },
    { name: "NAVY-DUSTY", hex: "#232e42" },
    { name: "NAVY VARIASI ABU", hex: "#283446" },
    { name: "NAVY ALTRA", hex: "#0a1224" },
    { name: "MUSTARD", hex: "#e1ad01" },
    { name: "MOTIF PUTIH", hex: "#fafafa" },
    { name: "MOTIF NAVY", hex: "#1e293b" },
    { name: "MOTIF HITAM", hex: "#111827" },
    { name: "MOCCA", hex: "#a38069" },
    { name: "MISTY VARIASI MARUN", hex: "#b5a4a9" },
    { name: "MISTY VARIASI HITAM", hex: "#a4a4a4" },
    { name: "MINERAL-STONEGREY", hex: "#708090" },
    { name: "MINERAL-SALUR", hex: "#657c8a" },
    { name: "MINERAL BLUE", hex: "#3f5e73" },
    { name: "MINERAL", hex: "#5a7684" },
    { name: "MILO", hex: "#826251" },
    { name: "MERAH-HITAM", hex: "#b81d24" },
    { name: "MERAH-ABU", hex: "#c92630" },
    { name: "MERAH CABE-PUTIH", hex: "#e52a36" },
    { name: "MERAH CABE-NAVY", hex: "#cc111a" },
    { name: "MERAH CABE", hex: "#e60012" },
    { name: "MERAH BENDERA", hex: "#ff0000" },
    { name: "MERAH BATA VAR HITAM", hex: "#b33620" },
    { name: "MERAH BATA", hex: "#c24b38" },
    { name: "MERAH", hex: "#e60012" },
    { name: "MEDIUM GREY", hex: "#808080" },
    { name: "MARUN-PUTIH", hex: "#6a1a24" },
    { name: "MARUN-KHEKY", hex: "#731f2b" },
    { name: "MARUN-HITAM", hex: "#5a121b" },
    { name: "MARUN KERAH", hex: "#7a1c28" },
    { name: "MARUN", hex: "#800000" },
    { name: "MAGENTA", hex: "#ff00ff" },
    { name: "LUMUT", hex: "#4a5d4e" },
    { name: "LIGHT GREY", hex: "#d3d3d3" },
    { name: "LIGHT BROWN", hex: "#b5651d" },
    { name: "LAVENDER-LILAC", hex: "#d8b2d8" },
    { name: "LAVENDER", hex: "#e6e6fa" },
    { name: "LACOST CVC LIST", hex: "#334e68" },
    { name: "KUNING VARIASI NAVY", hex: "#f0c808" },
    { name: "KUNING VARIASI HIJAU", hex: "#ebd010" },
    { name: "KUNING MUSTARD", hex: "#e1ad01" },
    { name: "KUNING MAS-ALMOND", hex: "#f0d368" },
    { name: "KUNING MAS", hex: "#ffd700" },
    { name: "KUNING KUNYIT", hex: "#e3a813" },
    { name: "KUNING EMAS-HITAM", hex: "#cfac17" },
    { name: "KUNING EMAS ALTRA", hex: "#d4af37" },
    { name: "KUNING EMAS", hex: "#ffd700" },
    { name: "KUNING", hex: "#ffff00" },
    { name: "KOTAK", hex: "#7f8c8d" },
    { name: "KHEKY", hex: "#c3b091" },
    { name: "KENARI-TURKIS SEDANG", hex: "#eae31a" },
    { name: "KENARI PUTIH", hex: "#fdfde2" },
    { name: "KENARI", hex: "#f3e5ab" },
    { name: "JADE GREEN", hex: "#00a86b" },
    { name: "IVORY", hex: "#fffff0" },
    { name: "HITAM-TERACOTA", hex: "#1a0d0d" },
    { name: "HITAM-PUTIH", hex: "#1a1a1a" },
    { name: "HITAM-MINERAL", hex: "#121212" },
    { name: "HITAM-MARUN", hex: "#180a0a" },
    { name: "HITAM-HIJAU BOTOL", hex: "#0a1a0f" },
    { name: "HITAM KERAH", hex: "#141414" },
    { name: "HITAM", hex: "#000000" },
    { name: "HIJAU-BENHUR", hex: "#1b6e4e" },
    { name: "HIJAU VARIASI BENHUR", hex: "#227a58" },
    { name: "HIJAU TUA ALTRA", hex: "#1b4c3e" },
    { name: "HIJAU STABILO", hex: "#00ff00" },
    { name: "HIJAU SAMPURNA", hex: "#2ecc71" },
    { name: "HIJAU SAGE", hex: "#9caf88" },
    { name: "HIJAU PUPUS", hex: "#98fb98" },
    { name: "HIJAU MINT", hex: "#3eb489" },
    { name: "HIJAU HITAM", hex: "#1e3328" },
    { name: "HIJAU FUJI", hex: "#27ae60" },
    { name: "HIJAU BOTOL-KUNYIT", hex: "#12301f" },
    { name: "HIJAU BOTOL-ABU", hex: "#183c27" },
    { name: "HIJAU BOTOL", hex: "#004b23" },
    { name: "HIJAU BABY", hex: "#98fb98" },
    { name: "HIJAU", hex: "#008000" },
    { name: "GREENTEA", hex: "#adff2f" },
    { name: "GRAPENECTAR-ABU", hex: "#6a4c58" },
    { name: "GRAPE NECTAR", hex: "#5c3a47" },
    { name: "GOLD", hex: "#ffd700" },
    { name: "FUNKY GREEN", hex: "#39ff14" },
    { name: "ERMINE", hex: "#c0c0c0" },
    { name: "ENSIGHT BLUE", hex: "#2a52be" },
    { name: "DUTCH BLUE-ABU MUDA", hex: "#3b5a9a" },
    { name: "DUTCH BLUE", hex: "#4169e1" },
    { name: "DUSTY ROSE", hex: "#cca7a2" },
    { name: "DUSTY BLUE", hex: "#8c9fa8" },
    { name: "DUSTY", hex: "#bfa3a3" },
    { name: "DORENG", hex: "#556b2f" },
    { name: "DONGKER ALTRA", hex: "#0a1128" },
    { name: "DIMGRAY", hex: "#696969" },
    { name: "DIJON", hex: "#c4b270" },
    { name: "DESIGN MUNDU", hex: "#34495e" },
    { name: "DENIM BLUE", hex: "#224375" },
    { name: "DENIM", hex: "#1560bd" },
    { name: "DEEP BLUE", hex: "#0047ab" },
    { name: "DARK WINE", hex: "#58111a" },
    { name: "DARK MUSTARD", hex: "#a88200" },
    { name: "DARK KHEKY", hex: "#8b7e66" },
    { name: "DARK GREY", hex: "#a9a9a9" },
    { name: "DARK GREEN", hex: "#006400" },
    { name: "CREAM", hex: "#fffdd0" },
    { name: "CRACKERY", hex: "#d2b48c" },
    { name: "COLORFULL", hex: "#e67e22" },
    { name: "COKSU", hex: "#dfc9b1" },
    { name: "COKLAT-COKLAT TUA", hex: "#5c4033" },
    { name: "COKLAT POLISI", hex: "#654321" },
    { name: "COKLAT MUDA", hex: "#a0522d" },
    { name: "COKLAT", hex: "#8b4513" },
    { name: "CINNAMON", hex: "#d2691e" },
    { name: "CHOCOMILK", hex: "#987654" },
    { name: "CARAMEL", hex: "#c68e17" },
    { name: "CAPPUCINO", hex: "#4b382a" },
    { name: "CACTUS GREEN", hex: "#5b8266" },
    { name: "BUTTER", hex: "#f3e5ab" },
    { name: "BRONZE", hex: "#cd7f32" },
    { name: "BLUSH RED", hex: "#e55b6c" },
    { name: "BLUE MIRAGE", hex: "#5c6b73" },
    { name: "BLACKSAND", hex: "#363636" },
    { name: "BIRU-KUNING", hex: "#1a4c8c" },
    { name: "BIRU-HITAM", hex: "#0f2e59" },
    { name: "BIRU TUA", hex: "#00008b" },
    { name: "BIRU MUDA", hex: "#add8e6" },
    { name: "BIRU CYAN", hex: "#00ffff" },
    { name: "BIRU ALTRA", hex: "#005080" },
    { name: "BIRU", hex: "#0000ff" },
    { name: "BENHUR KERAH", hex: "#245fa7" },
    { name: "BEIGE", hex: "#f5f5dc" },
    { name: "BATA-ABU", hex: "#c35f47" },
    { name: "BABY PINK", hex: "#ffc0cb" },
    { name: "ATLANTIC SEA", hex: "#006994" },
    { name: "ARMY-OLIVE GREEN", hex: "#4b5320" },
    { name: "ARMY", hex: "#4b5320" },
    { name: "ARABIAN SPACE", hex: "#232230" },
    { name: "AQUA-TURKIS SEDANG", hex: "#00ffff" },
    { name: "AQUA HAZE", hex: "#f4f6f7" },
    { name: "ALMOND-ORANGEBATA", hex: "#e6b89c" },
    { name: "ALMOND", hex: "#eed9c4" },
    { name: "ABU-TOSCA", hex: "#7f8c8d" },
    { name: "ABU-NAVY", hex: "#4e5d6c" },
    { name: "ABU-HITAM", hex: "#404040" },
    { name: "ABU TUA", hex: "#a9a9a9" },
    { name: "ABU SEDANG", hex: "#bebebe" },
    { name: "ABU MUDA", hex: "#d3d3d3" },
    { name: "ABU MSTY-ORANGE BATA", hex: "#b3a096" },
    { name: "ABU MISTY", hex: "#dcdcdc" },
    { name: "ABU LIST PUTIH", hex: "#e2e2e2" },
    { name: "ABU KERAH", hex: "#bebebe" },
    { name: "ABU", hex: "#808080" },
];

// State Dropdown Pencarian Warna
const searchQuery = ref("");
const isColorDropdownOpen = ref(false);

const filteredColors = computed(() => {
    const sorted = [...companyColors].sort((a, b) =>
        a.name.localeCompare(b.name),
    );
    if (!searchQuery.value) return sorted;
    return sorted.filter((color) =>
        color.name.toLowerCase().includes(searchQuery.value.toLowerCase()),
    );
});

const activeColorName = computed(() => {
    const matched = companyColors.find(
        (c) => c.hex.toLowerCase() === store.shirtColor.toLowerCase(),
    );
    return matched ? matched.name : "PILIH WARNA PRODUKSI";
});

const selectCompanyColor = (color: { name: string; hex: string }) => {
    store.shirtColor = color.hex;
    isColorDropdownOpen.value = false;
    searchQuery.value = "";
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
        } else if (!newObj) {
            textInput.value = "";
        }
    },
    { deep: true },
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
</script>

<template>
    <div
        class="bg-white/95 dark:bg-slate-900/95 border border-sky-100 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 text-slate-800 dark:text-slate-100 backdrop-blur-md relative overflow-hidden transition-all duration-300"
    >
        <!-- Top thin glow decoration -->
        <div
            class="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-sky-400/50 to-transparent"
        ></div>

        <!-- BAGIAN 1: Model & Sisi Pakaian -->
        <div class="space-y-4">
            <h3
                class="text-xs font-black uppercase tracking-wider text-sky-800 dark:text-sky-400 flex items-center gap-2"
            >
                <PhTShirt :size="16" weight="bold" />
                <span>Konfigurasi Kaos</span>
            </h3>

            <!-- Pilihan Model Kaos -->
            <div v-if="store.currentView !== 'both'">
                <label
                    class="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-2 tracking-wide"
                    >Pilih Model Kaos:</label
                >
                <div
                    class="grid grid-cols-3 gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-sky-100 dark:border-slate-800"
                >
                    <button
                        @click="
                            store.currentShirtType = 'tshirt';
                            store.saveToLocalStorage();
                        "
                        :class="[
                            'py-2 px-1 text-[11px] font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer',
                            store.currentShirtType === 'tshirt'
                                ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20 dark:shadow-slate-950/45 border border-sky-500/10'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50',
                        ]"
                    >
                        T-Shirt
                    </button>
                    <button
                        @click="
                            store.currentShirtType = 'longTshirt';
                            store.saveToLocalStorage();
                        "
                        :class="[
                            'py-2 px-1 text-[11px] font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer',
                            store.currentShirtType === 'longTshirt'
                                ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20 dark:shadow-slate-950/45 border border-sky-500/10'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50',
                        ]"
                    >
                        Lengan Panjang
                    </button>
                    <button
                        @click="
                            store.currentShirtType = 'polo';
                            store.saveToLocalStorage();
                        "
                        :class="[
                            'py-2 px-1 text-[11px] font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer',
                            store.currentShirtType === 'polo'
                                ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20 dark:shadow-slate-950/45 border border-sky-500/10'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50',
                        ]"
                    >
                        Polo
                    </button>
                </div>
            </div>

            <!-- Sisi Kaos Toggle -->
            <div>
                <label
                    class="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-2 tracking-wide"
                    >Pilih Tampilan Sisi:</label
                >
                <div
                    class="grid grid-cols-3 gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-sky-100 dark:border-slate-800"
                >
                    <button
                        @click="store.currentView = 'front'"
                        :class="[
                            'py-2 px-1 text-[11px] font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer',
                            store.currentView === 'front'
                                ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20 dark:shadow-slate-950/45 border border-sky-500/10'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50',
                        ]"
                    >
                        Depan
                    </button>
                    <button
                        @click="store.currentView = 'back'"
                        :class="[
                            'py-2 px-1 text-[11px] font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer',
                            store.currentView === 'back'
                                ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20 dark:shadow-slate-950/45 border border-sky-500/10'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50',
                        ]"
                    >
                        Belakang
                    </button>
                    <button
                        @click="store.currentView = 'both'"
                        :class="[
                            'py-2 px-1 text-[11px] font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-1 cursor-pointer',
                            store.currentView === 'both'
                                ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20 dark:shadow-slate-950/45 border border-sky-500/10'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50',
                        ]"
                        title="Tampilkan tampak depan & belakang bersamaan (Preview saja)"
                    >
                        <PhEye :size="13" weight="bold" />
                        <span>Preview</span>
                    </button>
                </div>
            </div>

            <!-- Pilihan Ukuran Kaos (Sesuai Standar Perusahaan) -->
            <!-- Pilihan Ukuran Kaos (Sesuai Standar Perusahaan) -->
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <label
                        class="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide"
                        >Pilih Ukuran Kaos:</label
                    >
                    <button
                        @click="showSizeGuide = true"
                        class="text-[9px] font-bold text-sky-600 dark:text-sky-400 hover:text-sky-850 dark:hover:text-sky-300 transition-all flex items-center gap-1 cursor-pointer bg-transparent border-0 outline-none"
                        type="button"
                    >
                        <PhRuler :size="10" weight="bold" />
                        <span>Panduan Ukuran</span>
                    </button>
                </div>
                <div
                    class="grid grid-cols-6 gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-sky-100 dark:border-slate-800"
                >
                    <button
                        v-for="size in ['S', 'M', 'L', 'XL', 'XXL', 'XXXL']"
                        :key="size"
                        @click="
                            store.currentSize = size as any;
                            store.saveToLocalStorage();
                        "
                        :class="[
                            'py-1.5 px-0.5 text-[10px] font-extrabold rounded-lg transition-all duration-300 flex items-center justify-center cursor-pointer',
                            store.currentSize === size
                                ? 'bg-sky-600 text-white shadow-sm border border-sky-500/10'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50',
                        ]"
                    >
                        {{ size }}
                    </button>
                </div>
                <!-- Info Dimensi Ukuran Aktif (Informatif & Cantik) -->
                <div
                    class="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-sky-50/30 dark:bg-slate-950/20 border border-sky-100/40 dark:border-slate-805/60 rounded-xl text-[9px] text-slate-500 dark:text-slate-400"
                >
                    <span
                        class="font-extrabold text-sky-600 dark:text-sky-400 uppercase"
                        >Ukuran {{ store.currentSize }}:</span
                    >
                    <span
                        >Lebar
                        {{ store.shirtSizes[store.currentSize].width }} cm</span
                    >
                    <span class="text-slate-350 dark:text-slate-800">|</span>
                    <span
                        >Panjang
                        {{ store.shirtSizes[store.currentSize].length }}
                        cm</span
                    >
                </div>
            </div>

            <!-- Pilihan Warna Kaos -->
            <div class="space-y-3.5">
                <label
                    class="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide"
                    >Pilih Warna Kaos:</label
                >

                <!-- Preset Pilihan Cepat -->
                <div class="flex flex-wrap gap-2.5 items-center">
                    <button
                        v-for="color in presetColors"
                        :key="color.hex"
                        @click="store.shirtColor = color.hex"
                        :title="color.name"
                        :class="[
                            'w-8 h-8 rounded-full border border-slate-200 dark:border-slate-800 transition-all duration-300 relative hover:scale-115 focus:outline-none flex items-center justify-center cursor-pointer',
                            store.shirtColor.toLowerCase() ===
                            color.hex.toLowerCase()
                                ? 'ring-2 ring-sky-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-105 shadow-[0_0_15px_rgba(14,165,233,0.3)]'
                                : 'hover:border-slate-350',
                        ]"
                        :style="{ backgroundColor: color.hex }"
                    >
                        <!-- Checkmark untuk warna terpilih -->
                        <span
                            v-if="
                                store.shirtColor.toLowerCase() ===
                                color.hex.toLowerCase()
                            "
                            :class="[
                                'text-[10px] font-black',
                                color.hex === '#ffffff'
                                    ? 'text-slate-900'
                                    : 'text-white',
                            ]"
                        >
                            ✓
                        </span>
                    </button>
                </div>

                <!-- Dropdown Pencarian Warna Perusahaan -->
                <div class="relative w-full">
                    <!-- Overlay transparan penutup click-away -->
                    <div
                        v-if="isColorDropdownOpen"
                        @click="isColorDropdownOpen = false"
                        class="fixed inset-0 z-10 bg-transparent"
                    ></div>

                    <!-- Tombol Pemicu Dropdown -->
                    <button
                        @click="isColorDropdownOpen = !isColorDropdownOpen"
                        class="w-full flex items-center justify-between py-2.5 px-4 rounded-xl border border-sky-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100/80 dark:hover:bg-slate-900/60 transition-all text-xs font-bold text-slate-700 dark:text-slate-300 relative z-20 cursor-pointer"
                    >
                        <div class="flex items-center gap-2">
                            <span
                                class="w-4 h-4 rounded-full border border-slate-200/80 dark:border-slate-800 shadow-sm"
                                :style="{ backgroundColor: store.shirtColor }"
                            ></span>
                            <span class="tracking-wide">{{
                                activeColorName
                            }}</span>
                        </div>
                        <PhCaretDown
                            :size="14"
                            weight="bold"
                            class="text-slate-400 dark:text-slate-500"
                        />
                    </button>

                    <!-- Panel Dropdown Pencarian -->
                    <Transition name="fade">
                        <div
                            v-if="isColorDropdownOpen"
                            class="absolute top-full mt-1.5 left-0 right-0 max-h-64 overflow-y-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-sky-100 dark:border-slate-800 rounded-xl shadow-xl z-20 p-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150"
                        >
                            <!-- Input Pencarian -->
                            <input
                                v-model="searchQuery"
                                type="text"
                                placeholder="Cari warna perusahaan..."
                                class="w-full py-2 px-3 text-[11px] font-bold border border-sky-100 dark:border-slate-850 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50/50 dark:bg-slate-950/50 text-slate-800 dark:text-slate-200"
                                @click.stop
                            />

                            <!-- List Pilihan Warna -->
                            <div
                                class="max-h-44 overflow-y-auto space-y-0.5 pr-1"
                            >
                                <button
                                    v-for="color in filteredColors"
                                    :key="color.name"
                                    @click="selectCompanyColor(color)"
                                    class="w-full py-2 px-3 rounded-lg text-left text-[11px] font-bold text-slate-700 dark:text-slate-350 hover:bg-sky-50 dark:hover:bg-slate-800 hover:text-sky-600 dark:hover:text-sky-400 transition-all flex items-center justify-between cursor-pointer"
                                >
                                    <div class="flex items-center gap-2">
                                        <span
                                            class="w-3.5 h-3.5 rounded-full border border-slate-200 dark:border-slate-700"
                                            :style="{
                                                backgroundColor: color.hex,
                                            }"
                                        ></span>
                                        <span>{{ color.name }}</span>
                                    </div>
                                    <span
                                        v-if="
                                            store.shirtColor.toLowerCase() ===
                                            color.hex.toLowerCase()
                                        "
                                        class="text-sky-500 font-extrabold text-[10px]"
                                        >✓</span
                                    >
                                </button>
                                <div
                                    v-if="filteredColors.length === 0"
                                    class="text-center py-4 text-[10px] text-slate-400 dark:text-slate-500 font-bold"
                                >
                                    Warna tidak ditemukan
                                </div>
                            </div>
                        </div>
                    </Transition>
                </div>
            </div>
        </div>

        <!-- BAGIAN Pengaturan Objek Layer / Hapus (Hanya muncul jika ada objek dipilih) -->
        <Transition name="fade">
            <div
                v-if="selectedObject"
                class="padding-4 space-y-3.5 p-4.5 bg-slate-50/70 dark:bg-slate-950/40 border border-sky-100 dark:border-slate-800 rounded-2xl transition-all duration-300 relative overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-4 duration-200"
            >
                <!-- Glow strip -->
                <div class="absolute left-0 top-0 bottom-0 w-[2px]"></div>

                <h4
                    class="text-[10px] font-black uppercase tracking-widest text-sky-850 dark:text-sky-350 pl-1"
                >
                    Pengaturan Objek Terpilih
                </h4>
                <div class="grid grid-cols-3 gap-2">
                    <button
                        @click="emit('bring-to-front')"
                        class="py-2 px-2.5 text-[9px] font-bold uppercase tracking-wider bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 hover:border-sky-300 dark:hover:border-slate-700 hover:bg-sky-50 dark:hover:bg-slate-850 rounded-xl text-slate-750 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-all flex items-center justify-center gap-1 hover:scale-102 active:scale-98 shadow-sm cursor-pointer"
                    >
                        <PhArrowUp :size="12" weight="bold" />
                        <span>Ke Depan</span>
                    </button>
                    <button
                        @click="emit('send-to-back')"
                        class="py-2 px-2.5 text-[9px] font-bold uppercase tracking-wider bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 hover:border-sky-300 dark:hover:border-slate-700 hover:bg-sky-50 dark:hover:bg-slate-850 rounded-xl text-slate-750 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-all flex items-center justify-center gap-1 hover:scale-102 active:scale-98 shadow-sm cursor-pointer"
                    >
                        <PhArrowDown :size="12" weight="bold" />
                        <span>Ke Belakang</span>
                    </button>
                    <button
                        @click="emit('delete-selected')"
                        class="py-2 px-2.5 text-[9px] font-bold uppercase tracking-wider bg-white dark:bg-slate-900 border border-red-100 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl text-red-650 dark:text-red-400 hover:text-red-750 dark:hover:text-red-300 transition-all flex items-center justify-center gap-1 hover:scale-102 active:scale-98 shadow-sm cursor-pointer"
                    >
                        <PhTrash :size="12" weight="bold" />
                        <span>Hapus</span>
                    </button>
                </div>
            </div>
        </Transition>

        <!-- Pesan Info Mode Preview (Hanya tampil saat mode 'both') -->
        <div
            v-if="store.currentView === 'both'"
            class="p-5 bg-sky-50/80 border border-sky-200/60 rounded-2xl text-center space-y-3 shadow-sm animate-in fade-in duration-300"
        >
            <div
                class="w-10 h-10 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mx-auto shadow-sm"
            >
                <PhSparkle :size="20" weight="bold" class="animate-pulse" />
            </div>
            <h4 class="font-extrabold text-sm text-sky-950">
                Mode Preview Kedua Sisi
            </h4>
            <p class="text-[11px] text-slate-500 leading-relaxed">
                Anda sedang melihat tampilan kaos tampak depan dan tampak
                belakang secara bersamaan. Untuk mengedit desain sablon, silakan
                pilih tombol <strong>Depan</strong> or
                <strong>Belakang</strong> pada menu konfigurasi di atas.
            </p>
        </div>

        <template v-if="store.currentView !== 'both'">
            <hr class="border-sky-100/50" />

            <!-- BAGIAN 2: Tambahkan / Edit Teks -->
            <div class="space-y-4">
                <div class="flex justify-between items-center">
                    <h3
                        class="text-xs font-black uppercase tracking-wider text-sky-800 flex items-center gap-2"
                    >
                        <PhTextT :size="16" weight="bold" />
                        <span>{{
                            isTextSelected
                                ? "Edit Teks Aktif"
                                : "Tambahkan Teks"
                        }}</span>
                    </h3>
                    <span
                        v-if="isTextSelected"
                        class="text-[9px] bg-sky-100 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-md font-bold tracking-wide"
                        >Teks Dipilih</span
                    >
                </div>

                <!-- Input Text -->
                <div class="space-y-1.5">
                    <div class="relative">
                        <span
                            class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400"
                        >
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
                        <label
                            class="text-[10px] uppercase font-bold text-slate-500 tracking-wide"
                            >Jenis Font:</label
                        >
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
                            <span
                                class="absolute right-3 inset-y-0 flex items-center pointer-events-none text-slate-400 text-[10px]"
                                >▼</span
                            >
                        </div>
                    </div>

                    <!-- Warna Teks -->
                    <div class="space-y-1.5">
                        <label
                            class="text-[10px] uppercase font-bold text-slate-500 tracking-wide"
                            >Warna Sablon:</label
                        >
                        <div class="flex gap-2.5 items-center">
                            <div
                                class="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center hover:border-sky-500/50 transition-colors"
                            >
                                <input
                                    type="color"
                                    v-model="textColor"
                                    @input="handleColorChange"
                                    class="absolute w-[150%] h-[150%] cursor-pointer border-0 p-0 bg-transparent"
                                />
                            </div>
                            <span
                                class="text-xs uppercase text-slate-700 font-mono font-bold select-all tracking-wider"
                                >{{ textColor }}</span
                            >
                        </div>
                    </div>
                </div>

                <!-- Ukuran Font Slider (Hanya aktif jika teks dipilih untuk diedit) -->
                <div v-if="isTextSelected" class="space-y-1.5 pt-1.5">
                    <div
                        class="flex justify-between text-[10px] uppercase font-bold text-slate-500 tracking-wide"
                    >
                        <span>Ukuran Teks:</span>
                        <span class="font-mono text-sky-600 font-bold"
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
                        <span>{{
                            isTextSelected ? "Duplikat Baru" : "Tambahkan Teks"
                        }}</span>
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
                <h3
                    class="text-xs font-black uppercase tracking-wider text-sky-800 flex items-center gap-2"
                >
                    <PhUploadSimple :size="16" weight="bold" />
                    <span>Unggah Logo / Gambar</span>
                </h3>

                <div
                    @dragover="onDragOver"
                    @dragleave="onDragLeave"
                    @drop="onDrop"
                    :class="[
                        'border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 bg-slate-50/60 relative group',
                        isDragActive
                            ? 'border-sky-500 bg-sky-50 shadow-[0_0_20px_rgba(14,165,233,0.15)]'
                            : 'border-sky-200 hover:border-sky-400 hover:bg-sky-50/50',
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
                    <span class="text-xs font-bold text-slate-700 text-center"
                        >Klik atau seret logo ke sini</span
                    >
                    <span class="text-[10px] text-slate-400 mt-1"
                        >PNG, JPG, SVG maks 10MB</span
                    >
                </div>

                <!-- Pesan Error Pengaman -->
                <div
                    v-if="uploadError"
                    class="text-[10px] font-semibold text-red-500 bg-red-50 border border-red-200 py-2 px-3 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                >
                    <span
                        class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"
                    ></span>
                    {{ uploadError }}
                </div>

                <!-- Galeri Gambar Saya (storage sementara) -->
                <div
                    v-if="store.uploadedImages.length > 0"
                    class="space-y-2.5 pt-1"
                >
                    <label
                        class="block text-[10px] uppercase font-black text-slate-500 tracking-wider"
                        >Galeri Cache Sementara:</label
                    >
                    <div class="grid grid-cols-3 gap-2">
                        <div
                            v-for="img in store.uploadedImages"
                            :key="img.id"
                            class="relative group/thumb border border-slate-200 rounded-xl overflow-hidden bg-slate-50 h-16 cursor-pointer hover:border-sky-500/60 hover:shadow-lg hover:shadow-sky-500/5 transition-all duration-300 flex items-center justify-center"
                            @click="emit('add-image', img.dataUrl)"
                            :title="`Klik untuk menambahkan. Ukuran: ${formatBytes(img.size)} (Kompresi dari ${formatBytes(img.originalSize)})`"
                        >
                            <img
                                :src="img.dataUrl"
                                class="w-full h-full object-contain p-2"
                            />

                            <!-- Overlay Hover Info -->
                            <div
                                class="absolute inset-0 bg-sky-950/80 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-300 flex flex-col justify-center items-center text-[8px] text-sky-100 p-0.5 text-center"
                            >
                                <span
                                    class="font-black text-sky-300 tracking-wider"
                                    >KOMPRES</span
                                >
                                <span class="font-bold font-mono mt-0.5">{{
                                    formatBytes(img.size)
                                }}</span>
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
        </template>

        <hr class="border-sky-100/50" />

        <!-- BAGIAN 4: Latar Belakang Mockup -->
        <div class="space-y-4">
            <h3
                class="text-xs font-black uppercase tracking-wider text-sky-800 flex items-center gap-2"
            >
                <PhPalette :size="16" weight="bold" />
                <span>Latar Belakang Mockup</span>
            </h3>

            <!-- Pilihan Jenis Latar Belakang -->
            <div>
                <div
                    class="grid grid-cols-4 gap-1 bg-slate-50 p-1 rounded-xl border border-sky-100"
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
                            'py-2 px-1 text-[9px] font-black rounded-lg capitalize transition-all duration-300 flex flex-col items-center justify-center gap-1',
                            store.backdropType === type
                                ? 'bg-sky-600 text-white shadow shadow-sky-500/15 border border-sky-500/10'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/30',
                        ]"
                    >
                        <!-- Ikon Mini representatif -->
                        <PhPaintBrush
                            v-if="type === 'solid'"
                            :size="14"
                            weight="bold"
                        />
                        <PhGridFour
                            v-else-if="type === 'checkerboard'"
                            :size="14"
                            weight="bold"
                        />
                        <PhSparkle
                            v-else-if="type === 'gradient'"
                            :size="14"
                            weight="bold"
                        />
                        <PhImage
                            v-else-if="type === 'custom'"
                            :size="14"
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
            </div>

            <!-- Detail Kustomisasi Solid Color -->
            <div
                v-if="store.backdropType === 'solid'"
                class="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-sky-100 transition-all"
            >
                <span
                    class="text-[10px] uppercase font-bold text-slate-500 tracking-wide"
                    >Warna Latar:</span
                >
                <div class="flex gap-3 items-center">
                    <div
                        class="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center hover:border-sky-500/50 transition-colors"
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
                        class="text-xs font-mono uppercase text-slate-700 font-bold tracking-wider"
                        >{{ store.backdropColor }}</span
                    >
                    <button
                        @click="store.backdropColor = '#0f172a'"
                        class="text-[9px] font-bold uppercase tracking-wider py-1.5 px-3 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        Reset
                    </button>
                </div>
            </div>

            <!-- Detail Kustomisasi Custom Backdrop Image -->
            <div
                v-if="store.backdropType === 'custom'"
                class="space-y-3 transition-all"
            >
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
                    <PhImage
                        class="text-slate-400 group-hover:text-sky-500 transition-colors mb-1.5"
                        :size="20"
                        weight="bold"
                    />
                    <span class="text-[10px] font-bold text-slate-700"
                        >Pilih Foto Latar Belakang</span
                    >
                    <span class="text-[8px] text-slate-400 mt-0.5"
                        >Lantai kayu, hanger, atau foto studio</span
                    >
                </div>
                <!-- Preview Custom Image -->
                <div
                    v-if="store.customBackdropUrl"
                    class="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-sky-100"
                >
                    <div class="flex items-center gap-2.5">
                        <img
                            :src="store.customBackdropUrl"
                            class="w-8 h-8 object-cover rounded-lg border border-slate-200"
                        />
                        <span class="text-[10px] font-bold text-slate-500"
                            >Gambar terpasang</span
                        >
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

        <!-- BAGIAN 5: Ekspor Produksi & Mockup -->
        <div class="space-y-4 pt-1">
            <h3
                class="text-xs font-black uppercase tracking-wider text-sky-800 flex items-center gap-2"
            >
                <PhDownloadSimple :size="16" weight="bold" />
                <span>Ekspor Hasil Desain</span>
            </h3>
            <div class="grid grid-cols-2 gap-3.5 relative">
                <!-- Overlay transparan penutup dropdown saat mengklik di luar area -->
                <div
                    v-if="activeDropdown"
                    @click="activeDropdown = null"
                    class="fixed inset-0 z-10 cursor-default bg-transparent"
                ></div>

                <!-- Kontainer Unduh Sablon -->
                <div class="relative">
                    <button
                        @click.stop="toggleDropdown('print')"
                        class="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 font-bold text-xs transition-all duration-300 flex flex-col items-center justify-center gap-1.5 border border-slate-200 hover:border-slate-300 shadow-sm active:scale-[0.98] group cursor-pointer"
                    >
                        <PhFloppyDisk
                            class="text-slate-500 group-hover:text-slate-700 transition-colors"
                            :size="20"
                            weight="bold"
                        />
                        <div class="flex flex-col items-center">
                            <span>Unduh Sablon</span>
                            <span
                                class="text-[8.5px] text-slate-500 font-medium mt-0.5"
                                >Pilih sisi cetak</span
                            >
                        </div>
                    </button>

                    <!-- Dropdown Unduh Sablon -->
                    <Transition name="fade">
                        <div
                            v-if="activeDropdown === 'print'"
                            class="absolute bottom-full mb-2 left-0 right-0 bg-white/95 backdrop-blur-md border border-sky-100 rounded-2xl shadow-xl z-20 py-2 overflow-hidden flex flex-col text-left animate-in fade-in slide-in-from-bottom-2 duration-150"
                        >
                            <button
                                @click="handlePrintExport('front')"
                                class="px-4 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-sky-50 hover:text-sky-600 transition-all text-left flex items-center gap-2 cursor-pointer"
                            >
                                <span
                                    class="w-1.5 h-1.5 rounded-full bg-sky-500"
                                ></span>
                                Tampak Depan
                            </button>
                            <button
                                @click="handlePrintExport('back')"
                                class="px-4 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-sky-50 hover:text-sky-600 transition-all text-left flex items-center gap-2 cursor-pointer"
                            >
                                <span
                                    class="w-1.5 h-1.5 rounded-full bg-sky-500"
                                ></span>
                                Tampak Belakang
                            </button>
                            <div class="h-[1px] bg-sky-100/50 my-1"></div>
                            <button
                                @click="handlePrintExport('both')"
                                class="px-4 py-2.5 text-[11px] font-extrabold text-sky-600 hover:bg-sky-600 hover:text-white transition-all text-left flex items-center gap-2 cursor-pointer"
                            >
                                <PhSparkle :size="12" weight="bold" />
                                Depan + Belakang
                            </button>
                        </div>
                    </Transition>
                </div>

                <!-- Kontainer Unduh Mockup -->
                <div class="relative">
                    <button
                        @click.stop="toggleDropdown('mockup')"
                        class="w-full py-3 px-4 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all duration-300 flex flex-col items-center justify-center gap-1.5 border border-sky-500/10 shadow-md shadow-sky-500/15 active:scale-[0.98] group cursor-pointer"
                    >
                        <PhImage
                            class="text-sky-100 group-hover:text-white transition-colors"
                            :size="20"
                            weight="bold"
                        />
                        <div class="flex flex-col items-center">
                            <span>Unduh Mockup</span>
                            <span
                                class="text-[8.5px] text-sky-100 font-medium mt-0.5"
                                >Pilih sisi mockup</span
                            >
                        </div>
                    </button>

                    <!-- Dropdown Unduh Mockup -->
                    <Transition name="fade">
                        <div
                            v-if="activeDropdown === 'mockup'"
                            class="absolute bottom-full mb-2 left-0 right-0 bg-white/95 backdrop-blur-md border border-sky-100 rounded-2xl shadow-xl z-20 py-2 overflow-hidden flex flex-col text-left animate-in fade-in slide-in-from-bottom-2 duration-150"
                        >
                            <button
                                @click="handleMockupExport('front')"
                                class="px-4 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-sky-50 hover:text-sky-600 transition-all text-left flex items-center gap-2 cursor-pointer"
                            >
                                <span
                                    class="w-1.5 h-1.5 rounded-full bg-sky-500"
                                ></span>
                                Tampak Depan
                            </button>
                            <button
                                @click="handleMockupExport('back')"
                                class="px-4 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-sky-50 hover:text-sky-600 transition-all text-left flex items-center gap-2 cursor-pointer"
                            >
                                <span
                                    class="w-1.5 h-1.5 rounded-full bg-sky-500"
                                ></span>
                                Tampak Belakang
                            </button>
                            <div class="h-[1px] bg-sky-100/50 my-1"></div>
                            <button
                                @click="handleMockupExport('both')"
                                class="px-4 py-2.5 text-[11px] font-extrabold text-sky-600 hover:bg-sky-600 hover:text-white transition-all text-left flex items-center gap-2 cursor-pointer"
                            >
                                <PhSparkle :size="12" weight="bold" />
                                Depan + Belakang
                            </button>
                        </div>
                    </Transition>
                </div>
            </div>
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
                    class="bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-modal-pop text-slate-850 dark:text-slate-100"
                >
                    <!-- Modal Header -->
                    <div
                        class="px-5 py-4 border-b border-sky-50 dark:border-slate-800 flex justify-between items-center bg-sky-50/50 dark:bg-slate-950/20"
                    >
                        <div class="flex items-center gap-2">
                            <PhRuler
                                :size="16"
                                class="text-sky-600 dark:text-sky-400"
                                weight="bold"
                            />
                            <h3
                                class="font-extrabold text-[12px] tracking-tight text-slate-900 dark:text-white uppercase"
                            >
                                Panduan Ukuran
                            </h3>
                        </div>
                        <button
                            @click="showSizeGuide = false"
                            class="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all cursor-pointer bg-transparent border-0 outline-none"
                        >
                            <PhX :size="14" weight="bold" />
                        </button>
                    </div>

                    <!-- Modal Body -->
                    <div class="p-5 space-y-5">
                        <!-- Tabel Ukuran -->
                        <div
                            class="overflow-hidden border border-sky-100 dark:border-slate-800 rounded-xl"
                        >
                            <table
                                class="w-full text-[10px] text-left border-collapse"
                            >
                                <thead>
                                    <tr
                                        class="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-extrabold uppercase border-b border-sky-100 dark:border-slate-800"
                                    >
                                        <th class="px-3 py-2.5 text-center">
                                            Ukuran
                                        </th>
                                        <th class="px-3 py-2.5 text-center">
                                            Lebar (cm)
                                        </th>
                                        <th class="px-3 py-2.5 text-center">
                                            Panjang (cm)
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for="(dims, size) in store.shirtSizes"
                                        :key="size"
                                        class="border-b border-sky-50/50 dark:border-slate-800 last:border-0 hover:bg-sky-50/20 dark:hover:bg-slate-850/30 transition-all"
                                        :class="{
                                            'bg-sky-50/40 dark:bg-sky-950/20 font-bold text-sky-600 dark:text-sky-400':
                                                store.currentSize === size,
                                        }"
                                    >
                                        <td
                                            class="px-3 py-2 text-center font-black text-center"
                                        >
                                            {{ size }}
                                        </td>
                                        <td class="px-3 py-2 text-center">
                                            {{ dims.width }} cm
                                        </td>
                                        <td class="px-3 py-2 text-center">
                                            {{ dims.length }} cm
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Infografis Size Chart -->
                        <div
                            class="flex items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-950/45 rounded-xl border border-sky-100/50 dark:border-slate-800/85"
                        >
                            <img
                                :src="sizeChartImg"
                                alt="Ilustrasi Panduan Ukuran"
                                class="max-w-full max-h-[200px] object-contain rounded-lg filter dark:brightness-95"
                            />
                        </div>

                        <!-- Ilustrasi Cara Mengukur -->
                        <div
                            class="bg-sky-50/50 dark:bg-slate-950/30 border border-sky-100/50 dark:border-slate-800 p-3.5 rounded-xl flex gap-2.5"
                        >
                            <div
                                class="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-sky-600/10 text-sky-600 dark:text-sky-400"
                            >
                                <PhTShirt :size="14" weight="bold" />
                            </div>
                            <div class="space-y-1">
                                <h4
                                    class="text-[10px] font-extrabold text-slate-850 dark:text-white uppercase tracking-wider"
                                >
                                    Cara Mengukur Kaos
                                </h4>
                                <p
                                    class="text-[9px] text-slate-500 dark:text-slate-400 leading-relaxed"
                                >
                                    * <strong>Lebar:</strong> Ukur secara
                                    mendatar dari jahitan ketiak kiri ke ketiak
                                    kanan.<br />
                                    * <strong>Panjang:</strong> Ukur secara
                                    tegak lurus dari titik bahu tertinggi hingga
                                    ujung bawah kaos.<br />
                                    *
                                    <span
                                        class="text-amber-600 dark:text-amber-400 font-bold"
                                        >Toleransi Ukuran:</span
                                    >
                                    Terdapat batas toleransi ±1 s/d 2 cm.
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Modal Footer -->
                    <div
                        class="px-5 py-3 border-t border-sky-50 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-950/10"
                    >
                        <button
                            @click="showSizeGuide = false"
                            class="px-4 py-2 text-[10px] font-extrabold bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-md transition-all duration-300 hover:scale-103 cursor-pointer border-0 outline-none"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
/* Transisi halus slider */
input[type="range"]::-webkit-slider-thumb {
    box-shadow: 0 0 10px rgba(14, 165, 233, 0.4);
    border: 1.5px solid rgba(255, 255, 255, 0.8);
}
</style>
