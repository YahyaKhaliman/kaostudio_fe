<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useConfiguratorStore } from "../stores/configurator";
import {
    PhX,
    PhCalculator,
    PhTShirt,
    PhPrinter,
    PhCheck,
    PhFileText,
    PhArrowsOut,
    PhInfo,
} from "@phosphor-icons/vue";

const props = defineProps<{
    show: boolean;
    canvasRef: any;
}>();

const emit = defineEmits<{
    (e: "close"): void;
    (e: "create-offer", offerData: any): void;
}>();

const store = useConfiguratorStore();

// --- STATE ---
const loading = ref(false);
const frontMockupUrl = ref<string | null>(null);
const backMockupUrl = ref<string | null>(null);
const bothMockupUrl = ref<string | null>(null);
const activePreviewTab = ref<"front" | "back" | "both">("both");

// Kuantitas per ukuran
const qtyS = ref(0);
const qtyM = ref(0);
const qtyL = ref(0);
const qtyXL = ref(0);
const qtyXXL = ref(0);
const qtyXXXL = ref(0);

// Kuantitas yang disablon/cetak
const qtyPrintS = ref(0);
const qtyPrintM = ref(0);
const qtyPrintL = ref(0);
const qtyPrintXL = ref(0);
const qtyPrintXXL = ref(0);
const qtyPrintXXXL = ref(0);

const syncPrintQties = () => {
    qtyPrintS.value = qtyS.value;
    qtyPrintM.value = qtyM.value;
    qtyPrintL.value = qtyL.value;
    qtyPrintXL.value = qtyXL.value;
    qtyPrintXXL.value = qtyXXL.value;
    qtyPrintXXXL.value = qtyXXXL.value;
};

// Jenis Jasa terpilih
// Jasa: 'none' | 'SD' (DTF) | 'DP' (DTF Premium) | 'SB' (Plastisol) | 'BR' (Bordir) | 'PL' (Polyflex) | 'TG' (DTG)
const selectedService = ref<string>("SD");

// Detail Warna Polyflex jika PL terpilih
const isPolyflexGold = ref(false);

// Dimensi cetak (terdeteksi otomatis dari canvas atau bisa di-override)
const frontDimensions = ref({ width: 0, height: 0, area: 0 });
const backDimensions = ref({ width: 0, height: 0, area: 0 });
const frontDesignItems = ref<
    { type: "text" | "image"; label: string; dimensions: string }[]
>([]);
const backDesignItems = ref<
    { type: "text" | "image"; label: string; dimensions: string }[]
>([]);

// --- COMPUTED PROPERTIES ---

// Model Kaos Aktif & Nama Produk default
const activeShirtLabel = computed(() => {
    const colorName =
        store.shirtColor.toLowerCase() === "#ffffff" ? "Putih" : "Warna";
    if (store.currentShirtType === "tshirt") {
        return `Kaos Polos Cotton Combed 30s Lengan Pendek (${colorName})`;
    } else if (store.currentShirtType === "longTshirt") {
        return `Kaos Polos Cotton Combed 30s Lengan Panjang (${colorName})`;
    } else if (store.currentShirtType === "polo") {
        return `Kaos Polo CVC Lacoste (${colorName})`;
    }
    return "Pakaian Polos";
});

// Harga dasar barang/kaos per ukuran
const shirtBasePrices = computed(() => {
    const isPolo = store.currentShirtType === "polo";
    const isLong = store.currentShirtType === "longTshirt";

    let sToXl = 45000;
    if (isLong) sToXl = 55000;
    if (isPolo) sToXl = 65000;

    // Untuk warna gelap/custom biasanya ada charge extra di retail
    const isDark = store.shirtColor.toLowerCase() !== "#ffffff";
    const colorCharge = isDark ? 5000 : 0;

    return {
        S: sToXl + colorCharge,
        M: sToXl + colorCharge,
        L: sToXl + colorCharge,
        XL: sToXl + colorCharge,
        XXL: sToXl + 5000 + colorCharge, // XXL +Rp5.000
        XXXL: sToXl + 10000 + colorCharge, // XXXL +Rp10.000
    };
});

// Total Qty
const totalQty = computed(() => {
    return (
        Number(qtyS.value) +
        Number(qtyM.value) +
        Number(qtyL.value) +
        Number(qtyXL.value) +
        Number(qtyXXL.value) +
        Number(qtyXXXL.value)
    );
});

// Total Qty yang disablon
const totalPrintQty = computed(() => {
    return (
        Number(qtyPrintS.value) +
        Number(qtyPrintM.value) +
        Number(qtyPrintL.value) +
        Number(qtyPrintXL.value) +
        Number(qtyPrintXXL.value) +
        Number(qtyPrintXXXL.value)
    );
});

// Harga Jasa Satuan Depan & Belakang per pcs kaos
const servicePrices = computed(() => {
    const qty = totalPrintQty.value || 1; // Cegah pembagian dengan nol, minimal tier 1
    const service = selectedService.value;

    let frontUnit = 0;
    let backUnit = 0;

    if (service === "none") {
        return { front: 0, back: 0, total: 0 };
    }

    // A. Sablon DTF (SD) -> Rp 25 / cm²
    if (service === "SD") {
        frontUnit = Math.round(frontDimensions.value.area * 25);
        backUnit = Math.round(backDimensions.value.area * 25);
    }
    // B. DTF Premium (DP) -> Rp 35 / cm²
    else if (service === "DP") {
        frontUnit = Math.round(frontDimensions.value.area * 35);
        backUnit = Math.round(backDimensions.value.area * 35);
    }
    // C. Sablon Plastisol (SB) -> Flat rate
    else if (service === "SB") {
        const getPlastisolPrice = (dim: typeof frontDimensions.value) => {
            if (dim.area <= 0) return 0;
            // Deteksi ukuran A3, A4, A5 kasar dari area
            // A5: up to 310 cm²
            // A4: up to 625 cm²
            // A3: > 625 cm²
            if (dim.area <= 310) return 10000; // A5
            if (dim.area <= 625) return 20000; // A4
            return 35000; // A3
        };
        frontUnit = getPlastisolPrice(frontDimensions.value);
        backUnit = getPlastisolPrice(backDimensions.value);
    }
    // D. Bordir (BR) -> Tiered per cm² + min Rp5.000
    else if (service === "BR") {
        let costPerCm = 1500; // default < 11 pcs
        if (qty >= 500) costPerCm = 100;
        else if (qty >= 20) costPerCm = 500;
        else if (qty >= 11) costPerCm = 1000;

        const getBordirPrice = (dim: typeof frontDimensions.value) => {
            if (dim.area <= 0) return 0;
            const calc = dim.area * costPerCm;
            return Math.max(calc, 5000); // Batas minimum Rp 5.000
        };
        frontUnit = getBordirPrice(frontDimensions.value);
        backUnit = getBordirPrice(backDimensions.value);
    }
    // E. Polyflex (PL) -> Grosir vs Eceran, Gold vs Lainnya
    else if (service === "PL") {
        const isGrosir = qty >= 10;
        let costPerCm = isGrosir ? 40 : 50;
        if (isPolyflexGold.value) {
            costPerCm = isGrosir ? 55 : 65;
        }

        frontUnit = Math.round(frontDimensions.value.area * costPerCm);
        backUnit = Math.round(backDimensions.value.area * costPerCm);
    }
    // F. DTG (TG) -> Sederhanakan kalkulasi sesuai logic master DB
    else if (service === "TG") {
        const isWhite = store.shirtColor.toLowerCase() === "#ffffff";
        const getDtgPrice = (dim: typeof frontDimensions.value) => {
            if (dim.area <= 0) return 0;
            // Model A5, A4, A3
            let base = 35000; // default A3 Terang
            if (dim.area <= 310)
                base = isWhite ? 15000 : 25000; // A5
            else if (dim.area <= 625)
                base = isWhite ? 25000 : 35000; // A4
            else base = isWhite ? 35000 : 45000; // A3

            // Diskon Qty (grosir) jika >= 12 pcs
            if (qty >= 12) {
                base = Math.round(base * 0.85); // Potongan 15% untuk grosir
            }
            return base;
        };
        frontUnit = getDtgPrice(frontDimensions.value);
        backUnit = getDtgPrice(backDimensions.value);
    }

    return {
        front: frontUnit,
        back: backUnit,
        total: frontUnit + backUnit,
    };
});

// Perhitungan Rincian Tabel
const billingRows = computed(() => {
    const list: {
        type: "kaos" | "jasa";
        nama: string;
        ukuran: string;
        qty: number;
        harga: number;
        total: number;
    }[] = [];

    const sizes: ("S" | "M" | "L" | "XL" | "XXL" | "XXXL")[] = [
        "S",
        "M",
        "L",
        "XL",
        "XXL",
        "XXXL",
    ];
    const qtyMap = {
        S: qtyS.value,
        M: qtyM.value,
        L: qtyL.value,
        XL: qtyXL.value,
        XXL: qtyXXL.value,
        XXXL: qtyXXXL.value,
    };

    // 1. Tambahkan baris Kaos Polos
    sizes.forEach((sz) => {
        const q = Number(qtyMap[sz]);
        if (q > 0) {
            const h = shirtBasePrices.value[sz];
            list.push({
                type: "kaos",
                nama: activeShirtLabel.value,
                ukuran: sz,
                qty: q,
                harga: h,
                total: q * h,
            });
        }
    });

    // 2. Tambahkan baris Jasa (hanya jika ada jasa terpilih dan total desain ada)
    const serviceLabel = getServiceLabel(selectedService.value);
    const servicePrice = servicePrices.value.total;

    const qtyPrintMap = {
        S: qtyPrintS.value,
        M: qtyPrintM.value,
        L: qtyPrintL.value,
        XL: qtyPrintXL.value,
        XXL: qtyPrintXXL.value,
        XXXL: qtyPrintXXXL.value,
    };

    if (selectedService.value !== "none" && servicePrice > 0) {
        sizes.forEach((sz) => {
            const q = Number(qtyPrintMap[sz]);
            if (q > 0) {
                list.push({
                    type: "jasa",
                    nama: `${serviceLabel} (${frontDimensions.value.area > 0 ? "Depan" : ""}${frontDimensions.value.area > 0 && backDimensions.value.area > 0 ? " & " : ""}${backDimensions.value.area > 0 ? "Belakang" : ""})`,
                    ukuran: sz,
                    qty: q,
                    harga: servicePrice,
                    total: q * servicePrice,
                });
            }
        });
    }

    return list;
});

// Grand Total Harga
const grandTotal = computed(() => {
    return billingRows.value.reduce((sum, row) => sum + row.total, 0);
});

// --- METHODS ---

function getServiceLabel(code: string) {
    switch (code) {
        case "none":
            return "Tanpa Sablon/Cetak";
        case "SD":
            return "Sablon DTF Standard";
        case "DP":
            return "Sablon DTF Premium";
        case "SB":
            return "Sablon Plastisol";
        case "BR":
            return "Jasa Bordir Komputer";
        case "PL":
            return "Sablon Polyflex" + (isPolyflexGold.value ? " Gold" : "");
        case "TG":
            return "Sablon Direct to Garment (DTG)";
        default:
            return "Jasa Cetak Custom";
    }
}

// Deteksi otomatis bounding box objek di canvas
const detectDesignDimensions = () => {
    // 1. Desain Depan
    let frontObjects: any[] = [];
    if (store.currentView === "front" && props.canvasRef?.fabricCanvas) {
        frontObjects = props.canvasRef.fabricCanvas.getObjects();
    } else {
        const savedFront = store.canvasStates.front;
        frontObjects = savedFront?.json?.objects || [];
    }

    // 2. Desain Belakang
    let backObjects: any[] = [];
    if (store.currentView === "back" && props.canvasRef?.fabricCanvas) {
        backObjects = props.canvasRef.fabricCanvas.getObjects();
    } else {
        const savedBack = store.canvasStates.back;
        backObjects = savedBack?.json?.objects || [];
    }

    const pcm = 5.5; // Default standard scale px/cm

    const calcBounds = (objs: any[]) => {
        if (!objs || objs.length === 0) return { width: 0, height: 0, area: 0 };

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let totalArea = 0;

        objs.forEach((obj) => {
            const left = obj.left || 0;
            const top = obj.top || 0;
            const scaleX = obj.scaleX || 1;
            const scaleY = obj.scaleY || 1;
            const width = obj.width || 0;
            const height = obj.height || 0;

            const objW = width * scaleX;
            const objH = height * scaleY;

            if (left < minX) minX = left;
            if (top < minY) minY = top;
            if (left + objW > maxX) maxX = left + objW;
            if (top + objH > maxY) maxY = top + objH;

            // Hitung luas individual dalam cm2
            const itemWCm = Number((objW / pcm).toFixed(1));
            const itemHCm = Number((objH / pcm).toFixed(1));
            totalArea += itemWCm * itemHCm;
        });

        if (minX === Infinity) return { width: 0, height: 0, area: 0 };

        const wPx = maxX - minX;
        const hPx = maxY - minY;

        const wCm = Number((wPx / pcm).toFixed(1));
        const hCm = Number((hPx / pcm).toFixed(1));
        const area = Number(totalArea.toFixed(1));

        return { width: wCm, height: hCm, area };
    };

    const parseObjects = (objs: any[]) => {
        const pcm = 5.5; // px/cm
        return objs.map((obj) => {
            const isText =
                obj.type === "text" ||
                obj.type === "i-text" ||
                obj.type === "iText" ||
                obj.text !== undefined;
            const wCm = Number(
                ((obj.width * (obj.scaleX || 1)) / pcm).toFixed(1),
            );
            const hCm = Number(
                ((obj.height * (obj.scaleY || 1)) / pcm).toFixed(1),
            );

            let label = "Gambar Sablon";
            if (isText) {
                const txt = obj.text || "";
                const displayTxt =
                    txt.length > 15 ? txt.substring(0, 15) + "..." : txt;
                label = `Teks: "${displayTxt}"`;
            }

            return {
                type: (isText ? "text" : "image") as "text" | "image",
                label,
                dimensions: `${wCm} × ${hCm} cm`,
            };
        });
    };

    frontDimensions.value = calcBounds(frontObjects);
    backDimensions.value = calcBounds(backObjects);
    frontDesignItems.value = parseObjects(frontObjects);
    backDesignItems.value = parseObjects(backObjects);

    // Set Default Jasa cetak ke DTF (SD) jika terdeteksi ada sablon
    if (frontDimensions.value.area > 0 || backDimensions.value.area > 0) {
        if (selectedService.value === "none") {
            selectedService.value = "SD";
        }
    } else {
        selectedService.value = "none";
    }
};

// Generate Mockup Previews
const generatePreviews = async () => {
    if (!props.canvasRef) return;
    loading.value = true;
    try {
        const frontRes = await props.canvasRef.exportMockup("front");
        if (frontRes && frontRes[0]) {
            frontMockupUrl.value = frontRes[0].dataUrl;
        }

        const backRes = await props.canvasRef.exportMockup("back");
        if (backRes && backRes[0]) {
            backMockupUrl.value = backRes[0].dataUrl;
        }

        const bothRes = await props.canvasRef.exportMockup("both");
        if (bothRes && bothRes[0]) {
            bothMockupUrl.value = bothRes[0].dataUrl;
        }
    } catch (e) {
        console.error("Gagal memuat pratinjau mockup:", e);
    } finally {
        loading.value = false;
    }
};

// Format Rupiah helper
const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(val);
};

// Pemicu Penawaran Baru
const handleCreateOffer = () => {
    if (totalQty.value <= 0) {
        alert("Masukkan jumlah kuantitas pesanan terlebih dahulu.");
        return;
    }

    const offerData = {
        shirtLabel: activeShirtLabel.value,
        shirtType: store.currentShirtType,
        shirtColor: store.shirtColor,
        totalQty: totalQty.value,
        grandTotal: grandTotal.value,
        serviceType: selectedService.value,
        serviceLabel: getServiceLabel(selectedService.value),
        dimensions: {
            front: frontDimensions.value,
            back: backDimensions.value,
        },
        sizesBreakdown: {
            S: qtyS.value,
            M: qtyM.value,
            L: qtyL.value,
            XL: qtyXL.value,
            XXL: qtyXXL.value,
            XXXL: qtyXXXL.value,
        },
        sizesPrintBreakdown: {
            S: qtyPrintS.value,
            M: qtyPrintM.value,
            L: qtyPrintL.value,
            XL: qtyPrintXL.value,
            XXL: qtyPrintXXL.value,
            XXXL: qtyPrintXXXL.value,
        },
        billingRows: billingRows.value,
    };

    emit("create-offer", offerData);
};

// Auto-fill quantity active size
const setInitialActiveQty = () => {
    const size = store.currentSize;
    if (size === "S") {
        qtyS.value = 1;
        qtyPrintS.value = 1;
    } else if (size === "M") {
        qtyM.value = 1;
        qtyPrintM.value = 1;
    } else if (size === "L") {
        qtyL.value = 1;
        qtyPrintL.value = 1;
    } else if (size === "XL") {
        qtyXL.value = 1;
        qtyPrintXL.value = 1;
    } else if (size === "XXL") {
        qtyXXL.value = 1;
        qtyPrintXXL.value = 1;
    } else if (size === "XXXL") {
        qtyXXXL.value = 1;
        qtyPrintXXXL.value = 1;
    }
};

// Sync and Cap watchers
watch(qtyS, (newVal) => {
    if (qtyPrintS.value > newVal) qtyPrintS.value = newVal;
    else if (qtyPrintS.value === 0 && newVal > 0) qtyPrintS.value = newVal;
});
watch(qtyM, (newVal) => {
    if (qtyPrintM.value > newVal) qtyPrintM.value = newVal;
    else if (qtyPrintM.value === 0 && newVal > 0) qtyPrintM.value = newVal;
});
watch(qtyL, (newVal) => {
    if (qtyPrintL.value > newVal) qtyPrintL.value = newVal;
    else if (qtyPrintL.value === 0 && newVal > 0) qtyPrintL.value = newVal;
});
watch(qtyXL, (newVal) => {
    if (qtyPrintXL.value > newVal) qtyPrintXL.value = newVal;
    else if (qtyPrintXL.value === 0 && newVal > 0) qtyPrintXL.value = newVal;
});
watch(qtyXXL, (newVal) => {
    if (qtyPrintXXL.value > newVal) qtyPrintXXL.value = newVal;
    else if (qtyPrintXXL.value === 0 && newVal > 0) qtyPrintXXL.value = newVal;
});
watch(qtyXXXL, (newVal) => {
    if (qtyPrintXXXL.value > newVal) qtyPrintXXXL.value = newVal;
    else if (qtyPrintXXXL.value === 0 && newVal > 0)
        qtyPrintXXXL.value = newVal;
});

watch(qtyPrintS, (newVal) => {
    if (newVal > qtyS.value) qtyPrintS.value = qtyS.value;
});
watch(qtyPrintM, (newVal) => {
    if (newVal > qtyM.value) qtyPrintM.value = qtyM.value;
});
watch(qtyPrintL, (newVal) => {
    if (newVal > qtyL.value) qtyPrintL.value = qtyL.value;
});
watch(qtyPrintXL, (newVal) => {
    if (newVal > qtyXL.value) qtyPrintXL.value = qtyXL.value;
});
watch(qtyPrintXXL, (newVal) => {
    if (newVal > qtyXXL.value) qtyPrintXXL.value = qtyXXL.value;
});
watch(qtyPrintXXXL, (newVal) => {
    if (newVal > qtyXXXL.value) qtyPrintXXXL.value = qtyXXXL.value;
});

// Watch modal state untuk trigger inisialisasi
watch(
    () => props.show,
    (isOpen) => {
        if (isOpen) {
            qtyS.value = 0;
            qtyM.value = 0;
            qtyL.value = 0;
            qtyXL.value = 0;
            qtyXXL.value = 0;
            qtyXXXL.value = 0;

            qtyPrintS.value = 0;
            qtyPrintM.value = 0;
            qtyPrintL.value = 0;
            qtyPrintXL.value = 0;
            qtyPrintXXL.value = 0;
            qtyPrintXXXL.value = 0;

            setInitialActiveQty();
            detectDesignDimensions();
            generatePreviews();
        }
    },
);
</script>

<template>
    <div
        v-if="show"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-955/70 backdrop-blur-md"
        @click.self="emit('close')"
    >
        <!-- Card Utama Glassmorphism Premium -->
        <div
            class="bg-white/95 dark:bg-slate-900/95 border border-sky-100 dark:border-slate-800 rounded-3xl w-full max-w-6xl overflow-hidden shadow-2xl3 max-h-[92vh] animate-in zoom-in-95 duration-200 flex flex-col"
        >
            <!-- Header Modal -->
            <div
                class="p-5 border-b border-sky-100/60 dark:border-slate-850 flex items-center justify-between bg-slate-50/50 dark:bg-slate-955/20"
            >
                <div class="flex items-center gap-3">
                    <div
                        class="p-2 bg-sky-500/15 text-sky-600 dark:text-sky-400 rounded-xl"
                    >
                        <PhCalculator :size="20" weight="bold" />
                    </div>
                    <div>
                        <h3
                            class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100"
                        >
                            Estimasi Harga
                        </h3>
                        <p
                            class="text-[10px] text-slate-500 dark:text-slate-400 font-medium"
                        >
                            Kalkulasi otomatis kaos & jasa bordir/sablon sesuai
                            desain mockup
                        </p>
                    </div>
                </div>
                <button
                    @click="emit('close')"
                    class="w-8 h-8 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer"
                    type="button"
                >
                    <PhX :size="16" weight="bold" />
                </button>
            </div>

            <!-- Content Area (Grid Kiri-Kanan) -->
            <div
                class="flex-grow overflow-y-auto grid grid-cols-1 lg:grid-cols-12 min-h-0"
            >
                <!-- SISI KIRI: Pratinjau Desain Mockup (5 Cols) -->
                <div
                    class="lg:col-span-5 p-6 border-r border-sky-100/50 dark:border-slate-800 flex flex-col items-center justify-start bg-slate-50/30 dark:bg-slate-955/10 min-h-[300px]"
                >
                    <div class="w-full flex justify-between items-center mb-4">
                        <span
                            class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest"
                        >
                            Preview Mockup
                        </span>
                        <!-- Tab switcher sisi kaos -->
                        <div
                            class="flex bg-slate-200/60 dark:bg-slate-800 rounded-lg p-0.5 border border-sky-100/30 dark:border-slate-750"
                        >
                            <button
                                @click="activePreviewTab = 'front'"
                                class="px-2.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer"
                                :class="
                                    activePreviewTab === 'front'
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                "
                            >
                                Depan
                            </button>
                            <button
                                @click="activePreviewTab = 'back'"
                                class="px-2.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer"
                                :class="
                                    activePreviewTab === 'back'
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                "
                            >
                                Belakang
                            </button>
                            <button
                                @click="activePreviewTab = 'both'"
                                class="px-2.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer"
                                :class="
                                    activePreviewTab === 'both'
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                "
                            >
                                Preview
                            </button>
                        </div>
                    </div>

                    <!-- Gambar Kaos -->
                    <div
                        class="w-full flex items-center justify-center p-2 transition-all duration-300 min-h-[220px]"
                    >
                        <div
                            v-if="loading"
                            class="flex flex-col items-center gap-2"
                        >
                            <div
                                class="w-8 h-8 rounded-full border-4 border-sky-500/30 border-t-sky-600 animate-spin"
                            ></div>
                            <span class="text-[10px] text-slate-400"
                                >Menyiapkan Pratinjau...</span
                            >
                        </div>
                        <template v-else>
                            <!-- Mode Preview Berdampingan (Kedua Sisi) -->
                            <div
                                v-if="activePreviewTab === 'both'"
                                class="w-full flex gap-4 justify-center items-center py-2 perspective-1000"
                            >
                                <!-- Kaos Depan -->
                                <div
                                    class="relative w-[140px] h-[140px] md:w-[160px] md:h-[160px] rounded-2xl flex items-center justify-center overflow-hidden border border-sky-100 dark:border-slate-800 shadow-md bg-white dark:bg-slate-950/60 animate-preview-left transform-style-3d group/preview"
                                >
                                    <div
                                        class="absolute inset-0 w-full h-full flex items-center justify-center preview-card-front pointer-events-none"
                                    >
                                        <img
                                            v-if="frontMockupUrl"
                                            :src="frontMockupUrl"
                                            class="w-full h-full object-contain drop-shadow-md group-hover/preview:scale-[1.03] transition-transform duration-500"
                                            alt="Mockup Depan"
                                        />
                                    </div>
                                    <span
                                        class="absolute bottom-1.5 z-10 text-[7px] bg-sky-600/90 text-white font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-sm"
                                        >Depan</span
                                    >
                                </div>

                                <!-- Kaos Belakang -->
                                <div
                                    class="relative w-[140px] h-[140px] md:w-[160px] md:h-[160px] rounded-2xl flex items-center justify-center overflow-hidden border border-sky-100 dark:border-slate-800 shadow-md bg-white dark:bg-slate-950/60 animate-preview-right transform-style-3d group/preview"
                                >
                                    <div
                                        class="absolute inset-0 w-full h-full flex items-center justify-center preview-card-back pointer-events-none"
                                    >
                                        <img
                                            v-if="backMockupUrl"
                                            :src="backMockupUrl"
                                            class="w-full h-full object-contain drop-shadow-md group-hover/preview:scale-[1.03] transition-transform duration-500"
                                            alt="Mockup Belakang"
                                        />
                                    </div>
                                    <span
                                        class="absolute bottom-1.5 z-10 text-[7px] bg-sky-600/90 text-white font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-sm"
                                        >Belakang</span
                                    >
                                </div>
                            </div>

                            <!-- Mode Tunggal Sisi Depan -->
                            <div
                                v-else-if="activePreviewTab === 'front'"
                                class="relative w-[210px] h-[210px] rounded-2xl flex items-center justify-center overflow-hidden border border-sky-100 dark:border-slate-800 shadow-md bg-white dark:bg-slate-955/60 animate-preview-left transform-style-3d group/preview perspective-1000"
                            >
                                <div
                                    class="absolute inset-0 w-full h-full flex items-center justify-center preview-card-front pointer-events-none"
                                >
                                    <img
                                        v-if="frontMockupUrl"
                                        :src="frontMockupUrl"
                                        class="w-full h-full object-contain drop-shadow-lg group-hover/preview:scale-[1.03] transition-transform duration-500"
                                        alt="Mockup Depan"
                                    />
                                </div>
                                <span
                                    class="absolute bottom-2.5 z-10 text-[8px] bg-sky-600/90 text-white font-extrabold px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm"
                                    >Tampak Depan</span
                                >
                            </div>

                            <!-- Mode Tunggal Sisi Belakang -->
                            <div
                                v-else-if="activePreviewTab === 'back'"
                                class="relative w-[210px] h-[210px] rounded-2xl flex items-center justify-center overflow-hidden border border-sky-100 dark:border-slate-800 shadow-md bg-white dark:bg-slate-955/60 animate-preview-right transform-style-3d group/preview perspective-1000"
                            >
                                <div
                                    class="absolute inset-0 w-full h-full flex items-center justify-center preview-card-back pointer-events-none"
                                >
                                    <img
                                        v-if="backMockupUrl"
                                        :src="backMockupUrl"
                                        class="w-full h-full object-contain drop-shadow-lg group-hover/preview:scale-[1.03] transition-transform duration-500"
                                        alt="Mockup Belakang"
                                    />
                                </div>
                                <span
                                    class="absolute bottom-2.5 z-10 text-[8px] bg-sky-600/90 text-white font-extrabold px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm"
                                    >Tampak Belakang</span
                                >
                            </div>
                        </template>
                    </div>

                    <!-- Informasi Tambahan Bounding Box -->
                    <div
                        class="w-full max-w-[340px] mt-4 p-3 bg-sky-505/5 dark:bg-sky-500/10 border border-sky-100/30 dark:border-slate-800 rounded-xl flex flex-col gap-1.5"
                    >
                        <div
                            class="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1"
                        >
                            <PhInfo
                                :size="12"
                                weight="fill"
                                class="text-sky-500"
                            />
                            Titik Cetak/Bordir:
                        </div>
                        <div
                            class="grid grid-cols-2 gap-2 text-[10px] text-slate-600 dark:text-slate-350"
                        >
                            <div>
                                <span class="font-semibold">Depan:</span>
                                <span
                                    v-if="frontDimensions.area > 0"
                                    class="ml-1 text-slate-800 dark:text-white font-bold"
                                >
                                    {{ frontDimensions.width }} ×
                                    {{ frontDimensions.height }} cm
                                    <span class="text-slate-400"
                                        >({{ frontDimensions.area }} cm²)</span
                                    >
                                </span>
                                <span v-else class="ml-1 text-slate-400 italic"
                                    >Tidak ada desain</span
                                >
                            </div>
                            <div>
                                <span class="font-semibold">Belakang:</span>
                                <span
                                    v-if="backDimensions.area > 0"
                                    class="ml-1 text-slate-800 dark:text-white font-bold"
                                >
                                    {{ backDimensions.width }} ×
                                    {{ backDimensions.height }} cm
                                    <span class="text-slate-400"
                                        >({{ backDimensions.area }} cm²)</span
                                    >
                                </span>
                                <span v-else class="ml-1 text-slate-400 italic"
                                    >Tidak ada desain</span
                                >
                            </div>
                        </div>

                        <!-- Rincian Item Sablon/Teks -->
                        <div
                            v-if="
                                frontDesignItems.length > 0 ||
                                backDesignItems.length > 0
                            "
                            class="border-t border-sky-100/20 dark:border-slate-800/80 mt-2 pt-2 text-[9px] flex flex-col gap-2 max-h-[90px] overflow-y-auto"
                        >
                            <!-- Sisi Depan Items -->
                            <div
                                v-if="frontDesignItems.length > 0"
                                class="flex flex-col gap-1"
                            >
                                <span
                                    class="font-extrabold text-[8px] text-sky-500 dark:text-sky-400 uppercase tracking-wider"
                                    >Detail Sisi Depan:</span
                                >
                                <ul
                                    class="list-disc list-inside text-slate-500 dark:text-slate-400 flex flex-col gap-0.5 pl-1"
                                >
                                    <li
                                        v-for="(item, idx) in frontDesignItems"
                                        :key="idx"
                                        class="truncate"
                                    >
                                        <span
                                            class="font-semibold text-slate-700 dark:text-slate-200"
                                            >{{ item.label }}</span
                                        >
                                        <span
                                            class="text-slate-400 dark:text-slate-500 font-mono ml-1"
                                            >({{ item.dimensions }})</span
                                        >
                                    </li>
                                </ul>
                            </div>

                            <!-- Sisi Belakang Items -->
                            <div
                                v-if="backDesignItems.length > 0"
                                class="flex flex-col gap-1"
                            >
                                <span
                                    class="font-extrabold text-[8px] text-sky-500 dark:text-sky-400 uppercase tracking-wider"
                                    >Detail Sisi Belakang:</span
                                >
                                <ul
                                    class="list-disc list-inside text-slate-500 dark:text-slate-400 flex flex-col gap-0.5 pl-1"
                                >
                                    <li
                                        v-for="(item, idx) in backDesignItems"
                                        :key="idx"
                                        class="truncate"
                                    >
                                        <span
                                            class="font-semibold text-slate-700 dark:text-slate-200"
                                            >{{ item.label }}</span
                                        >
                                        <span
                                            class="text-slate-400 dark:text-slate-500 font-mono ml-1"
                                            >({{ item.dimensions }})</span
                                        >
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SISI KANAN: Formulir Kuantitas & Harga (7 Cols) -->
                <div class="lg:col-span-7 p-6 flex flex-col gap-6">
                    <!-- PANEL 1: Model & Input Kuantitas Kaos -->
                    <div class="flex flex-col gap-3">
                        <div class="flex items-center gap-1.5">
                            <PhTShirt :size="16" class="text-sky-500" />
                            <span
                                class="text-xs font-bold text-slate-700 dark:text-slate-205 uppercase tracking-wider"
                            >
                                Model Kaos & Kuantitas Pesanan
                            </span>
                        </div>

                        <div
                            class="p-4 bg-slate-50 dark:bg-slate-950/40 border border-sky-100/50 dark:border-slate-850 rounded-2xl flex flex-col gap-3.5"
                        >
                            <!-- Detail Model Kaos Polos Aktif -->
                            <div
                                class="flex justify-between items-center text-xs"
                            >
                                <span
                                    class="font-bold text-slate-800 dark:text-white"
                                    >{{ activeShirtLabel }}</span
                                >
                                <span class="text-slate-400 text-[10px]"
                                    >Auto-detected</span
                                >
                            </div>

                            <!-- Bagian 1: Jumlah Kaos Polos (Total Order) -->
                            <div class="flex flex-col gap-2">
                                <span
                                    class="text-[9.5px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                                >
                                    1. Jumlah Kaos Polos (Total Order)
                                </span>
                                <div
                                    class="grid grid-cols-3 md:grid-cols-6 gap-3"
                                >
                                    <div
                                        v-for="sz in [
                                            'S',
                                            'M',
                                            'L',
                                            'XL',
                                            'XXL',
                                            'XXXL',
                                        ]"
                                        :key="sz"
                                        class="flex flex-col gap-1"
                                    >
                                        <label
                                            class="text-[9px] font-black text-slate-400 text-center uppercase tracking-wider"
                                        >
                                            Size {{ sz }}
                                        </label>
                                        <input
                                            v-if="sz === 'S'"
                                            v-model.number="qtyS"
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            class="w-full px-2.5 py-1.5 rounded-lg border border-sky-105/50 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs font-bold dark:text-white focus:ring-1 focus:ring-sky-500 focus:outline-none"
                                        />
                                        <input
                                            v-else-if="sz === 'M'"
                                            v-model.number="qtyM"
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            class="w-full px-2.5 py-1.5 rounded-lg border border-sky-105/50 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs font-bold dark:text-white focus:ring-1 focus:ring-sky-500 focus:outline-none"
                                        />
                                        <input
                                            v-else-if="sz === 'L'"
                                            v-model.number="qtyL"
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            class="w-full px-2.5 py-1.5 rounded-lg border border-sky-105/50 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs font-bold dark:text-white focus:ring-1 focus:ring-sky-500 focus:outline-none"
                                        />
                                        <input
                                            v-else-if="sz === 'XL'"
                                            v-model.number="qtyXL"
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            class="w-full px-2.5 py-1.5 rounded-lg border border-sky-105/50 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs font-bold dark:text-white focus:ring-1 focus:ring-sky-500 focus:outline-none"
                                        />
                                        <input
                                            v-else-if="sz === 'XXL'"
                                            v-model.number="qtyXXL"
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            class="w-full px-2.5 py-1.5 rounded-lg border border-sky-105/50 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs font-bold dark:text-white focus:ring-1 focus:ring-sky-500 focus:outline-none"
                                        />
                                        <input
                                            v-else-if="sz === 'XXXL'"
                                            v-model.number="qtyXXXL"
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            class="w-full px-2.5 py-1.5 rounded-lg border border-sky-105/50 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs font-bold dark:text-white focus:ring-1 focus:ring-sky-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- Bagian 2: Jumlah Kaos yang Disablon (Hanya jika selectedService !== 'none') -->
                            <div
                                v-if="selectedService !== 'none'"
                                class="flex flex-col gap-2 border-t border-slate-200/50 dark:border-slate-800/40 pt-3"
                            >
                                <div class="flex justify-between items-center">
                                    <span
                                        class="text-[9.5px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                                    >
                                        2. Jumlah Kaos yang Disablon/Bordir
                                    </span>
                                    <button
                                        @click="syncPrintQties"
                                        class="text-[9px] font-black uppercase text-sky-600 dark:text-sky-400 hover:text-sky-500 transition-colors cursor-pointer border-0 bg-transparent outline-none"
                                        type="button"
                                        title="Samakan jumlah sablon dengan kuantitas kaos"
                                    >
                                        Samakan dengan Kaos
                                    </button>
                                </div>
                                <div
                                    class="grid grid-cols-3 md:grid-cols-6 gap-3"
                                >
                                    <div
                                        v-for="sz in [
                                            'S',
                                            'M',
                                            'L',
                                            'XL',
                                            'XXL',
                                            'XXXL',
                                        ]"
                                        :key="sz"
                                        class="flex flex-col gap-1"
                                    >
                                        <label
                                            class="text-[9px] font-black text-slate-400 text-center uppercase tracking-wider"
                                        >
                                            Size {{ sz }}
                                        </label>
                                        <input
                                            v-if="sz === 'S'"
                                            v-model.number="qtyPrintS"
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            class="w-full px-2.5 py-1.5 rounded-lg border border-sky-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs font-bold text-sky-600 dark:text-sky-400 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                                        />
                                        <input
                                            v-else-if="sz === 'M'"
                                            v-model.number="qtyPrintM"
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            class="w-full px-2.5 py-1.5 rounded-lg border border-sky-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs font-bold text-sky-600 dark:text-sky-400 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                                        />
                                        <input
                                            v-else-if="sz === 'L'"
                                            v-model.number="qtyPrintL"
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            class="w-full px-2.5 py-1.5 rounded-lg border border-sky-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs font-bold text-sky-600 dark:text-sky-400 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                                        />
                                        <input
                                            v-else-if="sz === 'XL'"
                                            v-model.number="qtyPrintXL"
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            class="w-full px-2.5 py-1.5 rounded-lg border border-sky-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs font-bold text-sky-600 dark:text-sky-400 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                                        />
                                        <input
                                            v-else-if="sz === 'XXL'"
                                            v-model.number="qtyPrintXXL"
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            class="w-full px-2.5 py-1.5 rounded-lg border border-sky-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs font-bold text-sky-600 dark:text-sky-400 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                                        />
                                        <input
                                            v-else-if="sz === 'XXXL'"
                                            v-model.number="qtyPrintXXXL"
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            class="w-full px-2.5 py-1.5 rounded-lg border border-sky-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs font-bold text-sky-600 dark:text-sky-400 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- PANEL 2: Pemilihan Jasa Sablon/Cetak -->
                    <div class="flex flex-col gap-3">
                        <div class="flex items-center gap-1.5">
                            <PhPrinter :size="16" class="text-sky-500" />
                            <span
                                class="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider"
                            >
                                Konfigurasi Jasa Cetak (Opsional)
                            </span>
                        </div>

                        <div
                            class="p-4 bg-slate-50 dark:bg-slate-950/40 border border-sky-100/50 dark:border-slate-850 rounded-2xl flex flex-col gap-3.5"
                        >
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="flex flex-col gap-1.5">
                                    <label
                                        class="text-[10px] font-black text-slate-400 uppercase tracking-wider"
                                    >
                                        Jenis Jasa
                                    </label>
                                    <select
                                        v-model="selectedService"
                                        class="px-3 py-2 rounded-xl border border-sky-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold focus:ring-1 focus:ring-sky-500 focus:outline-none cursor-pointer"
                                    >
                                        <option value="none">
                                            Tanpa Jasa Cetak (Hanya Polosan)
                                        </option>
                                        <option value="SD">
                                            Sablon DTF Standard (Rp25 / cm²)
                                        </option>
                                        <option value="DP">
                                            Sablon DTF Premium (Rp35 / cm²)
                                        </option>
                                        <option value="SB">
                                            Sablon Plastisol (Flat rate
                                            A3/A4/A5)
                                        </option>
                                        <option value="BR">
                                            Jasa Bordir Komputer (Tiered qty)
                                        </option>
                                        <option value="PL">
                                            Sablon Polyflex (Warna/Gold)
                                        </option>
                                        <option value="TG">
                                            Sablon Direct to Garment (DTG)
                                        </option>
                                    </select>
                                </div>

                                <!-- Opsi Spesifik untuk Polyflex -->
                                <div
                                    v-if="selectedService === 'PL'"
                                    class="flex flex-col justify-end pb-1"
                                >
                                    <label
                                        class="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-205"
                                    >
                                        <input
                                            type="checkbox"
                                            v-model="isPolyflexGold"
                                            class="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                                        />
                                        <span
                                            >Gunakan Bahan Warna GOLD
                                            (Emas)</span
                                        >
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- PANEL 3: Rincian Biaya (Billing Table) -->
                    <div class="flex-grow flex flex-col gap-2 min-h-[140px]">
                        <span
                            class="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider"
                        >
                            Rincian Pembayaran
                        </span>

                        <div
                            class="border border-sky-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-950/20 flex-grow flex flex-col"
                        >
                            <table
                                class="w-full text-xs text-left border-collapse"
                            >
                                <thead>
                                    <tr
                                        class="bg-slate-50 dark:bg-slate-950/60 border-b border-sky-100/50 dark:border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider"
                                    >
                                        <th class="px-4 py-2.5">Kategori</th>
                                        <th class="px-4 py-2.5">Deskripsi</th>
                                        <th class="px-3 py-2.5 text-center">
                                            Ukuran
                                        </th>
                                        <th class="px-3 py-2.5 text-center">
                                            Qty
                                        </th>
                                        <th class="px-4 py-2.5 text-right">
                                            Harga
                                        </th>
                                        <th class="px-4 py-2.5 text-right">
                                            Total
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-if="billingRows.length === 0">
                                        <td
                                            colspan="6"
                                            class="px-4 py-8 text-center text-slate-400 italic"
                                        >
                                            Masukkan kuantitas pesanan untuk
                                            melihat rincian biaya.
                                        </td>
                                    </tr>
                                    <tr
                                        v-else
                                        v-for="(row, idx) in billingRows"
                                        :key="idx"
                                        class="border-b border-sky-100/20 dark:border-slate-800/40 text-slate-700 dark:text-slate-350"
                                    >
                                        <td class="px-4 py-2">
                                            <span
                                                class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                                                :class="
                                                    row.type === 'kaos'
                                                        ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                                                        : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                                "
                                            >
                                                {{
                                                    row.type === "kaos"
                                                        ? "Kaos"
                                                        : "Jasa"
                                                }}
                                            </span>
                                        </td>
                                        <td
                                            class="px-4 py-2 truncate max-w-[180px] font-medium"
                                            :title="row.nama"
                                        >
                                            {{ row.nama }}
                                        </td>
                                        <td
                                            class="px-3 py-2 text-center font-bold text-slate-800 dark:text-white"
                                        >
                                            {{ row.ukuran }}
                                        </td>
                                        <td class="px-3 py-2 text-center">
                                            {{ row.qty }}
                                        </td>
                                        <td class="px-4 py-2 text-right">
                                            {{ formatRupiah(row.harga) }}
                                        </td>
                                        <td
                                            class="px-4 py-2 text-right font-semibold text-slate-900 dark:text-white"
                                        >
                                            {{ formatRupiah(row.total) }}
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot
                                    v-if="billingRows.length > 0"
                                    class="bg-slate-50 dark:bg-slate-950/40 border-t border-sky-100/60 dark:border-slate-800 font-bold text-slate-800 dark:text-white"
                                >
                                    <tr>
                                        <td
                                            colspan="3"
                                            class="px-4 py-3 text-right"
                                        >
                                            TOTAL ESTIMASI:
                                        </td>
                                        <td
                                            class="px-3 py-3 text-center text-sky-600 dark:text-sky-400"
                                        >
                                            {{ totalQty }}
                                        </td>
                                        <td class="px-4 py-3"></td>
                                        <td
                                            class="px-4 py-3 text-right text-sky-600 dark:text-sky-400 text-sm"
                                        >
                                            {{ formatRupiah(grandTotal) }}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <!-- FOOTER ACTIONS -->
                    <div
                        class="flex items-center justify-between border-t border-sky-100/50 dark:border-slate-800/80 pt-4 mt-auto"
                    >
                        <div class="flex items-center gap-2">
                            <span
                                class="text-[10px] text-slate-400 font-medium"
                            >
                                *Estimasi belum termasuk diskon berkala dan
                                ongkos kirim.
                            </span>
                        </div>
                        <div class="flex items-center gap-3">
                            <button
                                @click="emit('close')"
                                class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-750 dark:hover:bg-slate-700 text-white text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95"
                                type="button"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Input Number Spinner Styling */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    appearance: none;
    margin: 0;
}
input[type="number"] {
    -moz-appearance: textfield;
    appearance: textfield;
}

/* Background Checkerboard */
.bg-checkerboard-light {
    background-color: #f8fafc;
    background-image:
        linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
        linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
        linear-gradient(-45deg, transparent 75%, #e2e8f0 75%);
    background-size: 20px 20px;
    background-position:
        0 0,
        0 10px,
        10px -10px,
        -10px 0px;
}

/* Mempertahankan ruang 3D untuk child element */
.transform-style-3d {
    transform-style: preserve-3d;
}

/* Keyframes untuk Masuk 3D Kaos Depan */
@keyframes entry-left {
    0% {
        opacity: 0;
        transform: translateY(20px) scale(0.95) rotateY(-15deg);
    }
    100% {
        opacity: 1;
        transform: translateY(0) scale(1) rotateY(0deg);
    }
}

/* Keyframes untuk Masuk 3D Kaos Belakang */
@keyframes entry-right {
    0% {
        opacity: 0;
        transform: translateY(20px) scale(0.95) rotateY(15deg);
    }
    100% {
        opacity: 1;
        transform: translateY(0) scale(1) rotateY(0deg);
    }
}

/* Keyframes untuk Kaos Melayang Halus (Floating) */
@keyframes float-front {
    0% {
        transform: translateY(0px);
    }
    50% {
        transform: translateY(-6px);
    }
    100% {
        transform: translateY(0px);
    }
}

@keyframes float-back {
    0% {
        transform: translateY(0px);
    }
    50% {
        transform: translateY(-8px);
    }
    100% {
        transform: translateY(0px);
    }
}

/* Terapkan kelas animasi masuk */
.animate-preview-left {
    animation: entry-left 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.animate-preview-right {
    animation: entry-right 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s forwards;
}

/* Terapkan kelas melayang berkelanjutan */
.preview-card-front {
    animation: float-front 4.5s ease-in-out infinite;
}

.preview-card-back {
    animation: float-back 5s ease-in-out infinite;
}
</style>
