<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useConfiguratorStore } from "../stores/configurator";
import { useAuthStore } from "../stores/authStore";
import { fetchKalkulasiHarga, saveMockupDesign } from "../services/api";
import PenawaranFormModal from "./penawaranFormModal.vue";
import LoginModal from "./loginModal.vue";
import {
    PhX,
    PhCalculator,
    PhTShirt,
    PhPrinter,
    PhCheck,
    PhFileText,
    PhArrowsOut,
    PhInfo,
    PhWhatsappLogo,
    PhSpinner,
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
const authStore = useAuthStore();

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

export interface DesignItem {
    id: string;
    side: "front" | "back";
    type: "text" | "image";
    label: string;
    width: number;
    height: number;
    area: number;
    service: string;
}

// Jenis Jasa terpilih per objek/item desain
const selectedService = ref<string>("none");
const frontService = ref<string>("none");
const backService = ref<string>("none");

const designItems = ref<DesignItem[]>([]);
const designServiceMap = ref<Record<string, string>>({});

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
    const qty = totalPrintQty.value || 1;

    const calcSingleSidePrice = (
        service: string,
        dim: typeof frontDimensions.value,
    ) => {
        if (service === "none" || dim.area <= 0) return 0;

        if (service === "SD") {
            return Math.round(dim.area * 25);
        }
        if (service === "DP") {
            return Math.round(dim.area * 35);
        }
        if (service === "SB") {
            if (dim.area <= 310) return 10000;
            if (dim.area <= 625) return 20000;
            return 35000;
        }
        if (service === "BR") {
            let costPerCm = 1500;
            if (qty >= 500) costPerCm = 100;
            else if (qty >= 20) costPerCm = 500;
            else if (qty >= 11) costPerCm = 1000;
            return Math.max(dim.area * costPerCm, 5000);
        }
        if (service === "PL") {
            const isGrosir = qty >= 10;
            let costPerCm = isGrosir ? 40 : 50;
            if (isPolyflexGold.value) costPerCm = isGrosir ? 55 : 65;
            return Math.round(dim.area * costPerCm);
        }
        if (service === "TG") {
            const isWhite = store.shirtColor.toLowerCase() === "#ffffff";
            let base = 35000;
            if (dim.area <= 310) base = isWhite ? 15000 : 25000;
            else if (dim.area <= 625) base = isWhite ? 25000 : 35000;
            else base = isWhite ? 35000 : 45000;
            if (qty >= 12) base = Math.round(base * 0.85);
            return base;
        }
        return 0;
    };

    const frontUnit = calcSingleSidePrice(
        frontService.value,
        frontDimensions.value,
    );
    const backUnit = calcSingleSidePrice(
        backService.value,
        backDimensions.value,
    );

    return {
        front: frontUnit,
        back: backUnit,
        total: frontUnit + backUnit,
    };
});

// --- BACKEND API INTEGRATION ---
const backendBillingRows = ref<any[]>([]);
const backendGrandTotal = ref(0);
const backendActiveShirtLabel = ref("");
const isUsingBackend = ref(false);
const kalkulasiLoading = ref(false);
const backendError = ref<string | null>(null);

let latestKalkulasiRequestId = 0;

const fetchBackendKalkulasi = async () => {
    if (!props.show) return;

    const requestId = ++latestKalkulasiRequestId;
    kalkulasiLoading.value = true;
    backendError.value = null; // Reset error saat hit kalkulasi baru
    try {
        const payload = {
            jenisKaos: store.currentShirtType,
            warnaKaos: store.shirtColor,
            qtyS: qtyS.value,
            qtyM: qtyM.value,
            qtyL: qtyL.value,
            qtyXL: qtyXL.value,
            qtyXXL: qtyXXL.value,
            qtyXXXL: qtyXXXL.value,
            qtyPrintS: qtyPrintS.value,
            qtyPrintM: qtyPrintM.value,
            qtyPrintL: qtyPrintL.value,
            qtyPrintXL: qtyPrintXL.value,
            qtyPrintXXL: qtyPrintXXL.value,
            qtyPrintXXXL: qtyPrintXXXL.value,
            selectedService: frontService.value,
            frontService: frontService.value,
            backService: backService.value,
            designItems: designItems.value.map((item) => ({
                id: item.id,
                side: item.side,
                label: item.label,
                width: item.width,
                height: item.height,
                area: item.area,
                service: item.service,
            })),
            frontDimensions: frontDimensions.value,
            backDimensions: backDimensions.value,
            isPolyflexGold: isPolyflexGold.value,
            kodeKaos: store.activeProduct?.brg_kode || null,
        };

        const data = await fetchKalkulasiHarga(payload);

        if (requestId !== latestKalkulasiRequestId) return;

        backendBillingRows.value = data.billingRows;
        backendGrandTotal.value = data.subtotal;
        backendActiveShirtLabel.value = data.activeShirtLabel;
        isUsingBackend.value = true;
    } catch (e: any) {
        if (requestId !== latestKalkulasiRequestId) return;
        console.warn(
            "Gagal terhubung ke backend API, menggunakan kalkulasi lokal:",
            e,
        );
        isUsingBackend.value = false;

        // Tangkap pesan error spesifik dari response backend
        const msg =
            e.response?.data?.message ||
            e.message ||
            "Jenis kaos tersebut tidak ditemukan di database.";
        backendError.value = `${msg} Silakan hubungi admin.`;
    } finally {
        if (requestId === latestKalkulasiRequestId) {
            setTimeout(() => {
                kalkulasiLoading.value = false;
            }, 300);
        }
    }
};

watch(
    [
        qtyS,
        qtyM,
        qtyL,
        qtyXL,
        qtyXXL,
        qtyXXXL,
        qtyPrintS,
        qtyPrintM,
        qtyPrintL,
        qtyPrintXL,
        qtyPrintXXL,
        qtyPrintXXXL,
        selectedService,
        frontService,
        backService,
        designItems,
        isPolyflexGold,
        frontDimensions,
        backDimensions,
        () => store.currentShirtType,
        () => store.shirtColor,
        () => props.show,
    ],
    () => {
        fetchBackendKalkulasi();
    },
    { deep: true, immediate: true },
);

// Perhitungan Rincian Tabel
const localBillingRows = computed(() => {
    const list: {
        type: "kaos" | "jasa";
        kode?: string;
        nama: string;
        kategori?: string;
        ukuran: string;
        qty: number;
        harga: number;
        total: number;
        isCustomOrder?: boolean;
        sod_custom?: string;
        sod_custom_nama?: string;
        sod_custom_data?: string;
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

    // 2. Tambahkan baris Jasa Cetak (Per-item desain jika ada, atau fallback per-sisi)
    if (totalPrintQty.value > 0) {
        if (designItems.value.length > 0) {
            designItems.value.forEach((item) => {
                if (item.service !== "none" && item.area > 0) {
                    const labelSvc = getServiceLabel(item.service);
                    const posLabel =
                        item.side === "front" ? "Depan" : "Belakang";
                    const itemUkuran = getStandardDesignSize(
                        item.width,
                        item.height,
                        item.area,
                    );

                    let unitPrice = 0;
                    if (item.service === "SD")
                        unitPrice = Math.round(item.area * 25);
                    else if (item.service === "DP")
                        unitPrice = Math.round(item.area * 35);
                    else if (item.service === "SB") {
                        if (item.area <= 310) unitPrice = 10000;
                        else if (item.area <= 625) unitPrice = 20000;
                        else unitPrice = 35000;
                    } else if (item.service === "BR") {
                        const qty = totalPrintQty.value || 1;
                        let costPerCm = 1500;
                        if (qty >= 500) costPerCm = 100;
                        else if (qty >= 20) costPerCm = 500;
                        else if (qty >= 11) costPerCm = 1000;
                        unitPrice = Math.max(item.area * costPerCm, 5000);
                    } else if (item.service === "PL") {
                        const qty = totalPrintQty.value || 1;
                        const isGrosir = qty >= 10;
                        let costPerCm = isGrosir ? 40 : 50;
                        if (isPolyflexGold.value)
                            costPerCm = isGrosir ? 55 : 65;
                        unitPrice = Math.round(item.area * costPerCm);
                    } else if (item.service === "TG") {
                        const qty = totalPrintQty.value || 1;
                        const isWhite =
                            store.shirtColor.toLowerCase() === "#ffffff";
                        let base = 35000;
                        if (item.area <= 310) base = isWhite ? 15000 : 25000;
                        else if (item.area <= 625)
                            base = isWhite ? 25000 : 35000;
                        else base = isWhite ? 35000 : 45000;
                        if (qty >= 12) base = Math.round(base * 0.85);
                        unitPrice = base;
                    }

                    if (unitPrice > 0) {
                        const customDataObj = {
                            titikCetak: [
                                {
                                    keterangan: item.label || "Desain",
                                    sizeCetak: itemUkuran,
                                    panjang: item.width || 0,
                                    lebar: item.height || 0,
                                    service: item.service,
                                },
                            ],
                            hargaPerCm: item.service === "DP" ? 35 : 25,
                        };

                        list.push({
                            type: "jasa",
                            kode: `CUSTOM-${item.service}`,
                            nama: `${labelSvc} - ${item.label} (${posLabel})`,
                            kategori: "CUSTOM",
                            ukuran: itemUkuran,
                            qty: totalPrintQty.value,
                            harga: unitPrice,
                            total: totalPrintQty.value * unitPrice,
                            isCustomOrder: true,
                            sod_custom: "Y",
                            sod_custom_nama: `${labelSvc} - ${item.label} (${posLabel})`,
                            sod_custom_data: JSON.stringify(customDataObj),
                        });
                    }
                }
            });
        } else {
            if (
                frontService.value !== "none" &&
                servicePrices.value.front > 0
            ) {
                const frontLabel = getServiceLabel(frontService.value);
                const frontUkuran = getStandardDesignSize(
                    frontDimensions.value.width,
                    frontDimensions.value.height,
                    frontDimensions.value.area,
                );
                const frontCustomData = {
                    titikCetak: [
                        {
                            keterangan: "Sisi Depan",
                            sizeCetak: frontUkuran,
                            panjang: frontDimensions.value.width || 0,
                            lebar: frontDimensions.value.height || 0,
                            service: frontService.value,
                        },
                    ],
                    hargaPerCm: frontService.value === "DP" ? 35 : 25,
                };

                list.push({
                    type: "jasa",
                    kode: `CUSTOM-${frontService.value}`,
                    nama: `${frontLabel} (Depan)`,
                    kategori: "CUSTOM",
                    ukuran: frontUkuran,
                    qty: totalPrintQty.value,
                    harga: servicePrices.value.front,
                    total: totalPrintQty.value * servicePrices.value.front,
                    isCustomOrder: true,
                    sod_custom: "Y",
                    sod_custom_nama: `${frontLabel} (Depan)`,
                    sod_custom_data: JSON.stringify(frontCustomData),
                });
            }

            if (backService.value !== "none" && servicePrices.value.back > 0) {
                const backLabel = getServiceLabel(backService.value);
                const backUkuran = getStandardDesignSize(
                    backDimensions.value.width,
                    backDimensions.value.height,
                    backDimensions.value.area,
                );
                const backCustomData = {
                    titikCetak: [
                        {
                            keterangan: "Sisi Belakang",
                            sizeCetak: backUkuran,
                            panjang: backDimensions.value.width || 0,
                            lebar: backDimensions.value.height || 0,
                            service: backService.value,
                        },
                    ],
                    hargaPerCm: backService.value === "DP" ? 35 : 25,
                };

                list.push({
                    type: "jasa",
                    kode: `CUSTOM-${backService.value}`,
                    nama: `${backLabel} (Belakang)`,
                    kategori: "CUSTOM",
                    ukuran: backUkuran,
                    qty: totalPrintQty.value,
                    harga: servicePrices.value.back,
                    total: totalPrintQty.value * servicePrices.value.back,
                    isCustomOrder: true,
                    sod_custom: "Y",
                    sod_custom_nama: `${backLabel} (Belakang)`,
                    sod_custom_data: JSON.stringify(backCustomData),
                });
            }
        }
    }

    return list;
});

// Perhitungan Rincian Tabel Utama (Pilih backend jika tersedia)
const billingRows = computed(() => {
    return isUsingBackend.value
        ? backendBillingRows.value
        : localBillingRows.value;
});

// Grand Total Harga
const grandTotal = computed(() => {
    return isUsingBackend.value
        ? backendGrandTotal.value
        : billingRows.value.reduce(
              (sum: number, row: any) => sum + row.total,
              0,
          );
});

// --- METHODS ---

function getServiceLabel(code: string) {
    switch (code) {
        case "none":
            return "Tanpa cetak";
        case "BR":
            return "Bordir";
        case "SD":
            return "DTF Standart";
        case "DP":
            return "DTF Premium";
        case "TG":
            return "DTG";
        default:
            return "Jasa Cetak Custom";
    }
}

function getStandardDesignSize(
    width: number,
    height: number,
    area: number,
): string {
    const w = Number(width || 0);
    const h = Number(height || 0);
    const a = Number(area || 0);

    if (w <= 0 || h <= 0 || a <= 0) return "-";

    // Logo (10x10 cm ± 2.5cm)
    if (Math.abs(w - 10) <= 2.5 && Math.abs(h - 10) <= 2.5) {
        return "Logo";
    }

    // A5 (14.8 x 21.0 cm ± 2.5cm)
    if (
        (Math.abs(w - 14.8) <= 2.5 && Math.abs(h - 21.0) <= 2.5) ||
        (Math.abs(w - 21.0) <= 2.5 && Math.abs(h - 14.8) <= 2.5)
    ) {
        return "A5";
    }

    // A4 (21.0 x 29.7 cm ± 2.5cm)
    if (
        (Math.abs(w - 21.0) <= 2.5 && Math.abs(h - 29.7) <= 2.5) ||
        (Math.abs(w - 29.7) <= 2.5 && Math.abs(h - 21.0) <= 2.5)
    ) {
        return "A4";
    }

    // A3 (29.7 x 42.0 cm ± 2.5cm)
    if (
        (Math.abs(w - 29.7) <= 2.5 && Math.abs(h - 42.0) <= 2.5) ||
        (Math.abs(w - 42.0) <= 2.5 && Math.abs(h - 29.7) <= 2.5)
    ) {
        return "A3";
    }

    // Ukuran non-standar dengan kombinasi dimensi (misal: Custom (20.6 × 20.6))
    return `Custom (${w} × ${h})`;
}

// Deteksi otomatis bounding box objek di canvas
const detectDesignDimensions = () => {
    // 0. Simpan dulu state kanvas aktif terbaru ke Pinia store
    if (props.canvasRef?.saveCurrentState) {
        try {
            props.canvasRef.saveCurrentState();
        } catch (e) {
            console.warn("Gagal menyimpan state kanvas saat ini:", e);
        }
    }

    const getObjectsFromState = (side: "front" | "back") => {
        if (store.currentView === side && props.canvasRef?.fabricCanvas) {
            return props.canvasRef.fabricCanvas.getObjects() || [];
        }
        const saved = store.canvasStates[side];
        if (!saved) return [];
        if (saved.json && Array.isArray(saved.json.objects))
            return saved.json.objects;
        if (Array.isArray(saved.objects)) return saved.objects;
        return [];
    };

    // 1. Desain Depan & Belakang
    const frontObjects: any[] = getObjectsFromState("front");
    const backObjects: any[] = getObjectsFromState("back");

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

    const parseObjectsToItems = (
        objs: any[],
        side: "front" | "back",
    ): DesignItem[] => {
        const pcm = 5.5; // px/cm
        return objs.map((obj, idx) => {
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
            const area = Number((wCm * hCm).toFixed(1));

            let label = `Desain ${idx + 1}`;
            if (isText) {
                const txt = obj.text || "";
                const displayTxt =
                    txt.length > 15 ? txt.substring(0, 15) + "..." : txt;
                label = `Teks: "${displayTxt}"`;
            }

            const itemId =
                obj.id || `${side}-${idx}-${isText ? "text" : "img"}`;
            const existingService = designServiceMap.value[itemId] || "DP";

            return {
                id: itemId,
                side,
                type: (isText ? "text" : "image") as "text" | "image",
                label,
                width: wCm,
                height: hCm,
                area,
                service: existingService,
            };
        });
    };

    frontDimensions.value = calcBounds(frontObjects);
    backDimensions.value = calcBounds(backObjects);

    if (frontDimensions.value.area > 0) {
        if (frontService.value === "none") frontService.value = "DP";
    } else {
        frontService.value = "none";
    }

    if (backDimensions.value.area > 0) {
        if (backService.value === "none") backService.value = "DP";
    } else {
        backService.value = "none";
    }

    const parsedFront = parseObjectsToItems(frontObjects, "front");
    const parsedBack = parseObjectsToItems(backObjects, "back");

    let combinedItems: DesignItem[] = [...parsedFront, ...parsedBack];

    // Fallback jika tidak ada objek per-item tapi total area > 0
    if (combinedItems.length === 0) {
        if (frontDimensions.value.area > 0) {
            combinedItems.push({
                id: "fallback-front",
                side: "front",
                type: "image",
                label: "Desain Sisi Depan",
                width: frontDimensions.value.width,
                height: frontDimensions.value.height,
                area: frontDimensions.value.area,
                service:
                    designServiceMap.value["fallback-front"] ||
                    frontService.value ||
                    "DP",
            });
        }
        if (backDimensions.value.area > 0) {
            combinedItems.push({
                id: "fallback-back",
                side: "back",
                type: "image",
                label: "Desain Sisi Belakang",
                width: backDimensions.value.width,
                height: backDimensions.value.height,
                area: backDimensions.value.area,
                service:
                    designServiceMap.value["fallback-back"] ||
                    backService.value ||
                    "DP",
            });
        }
    }

    designItems.value = combinedItems;
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

    const formattedOfferItems = billingRows.value.map(
        (row: any, idx: number) => ({
            id: Date.now() + idx,
            kode:
                row.kode ||
                (row.type === "kaos"
                    ? store.activeProduct?.brg_kode || "KAOS"
                    : "CUSTOM"),
            nama: row.nama,
            kategori:
                row.kategori || (row.type === "kaos" ? "REGULER" : "CUSTOM"),
            ukuran: row.ukuran,
            stok: 0,
            jumlah: row.qty,
            harga: row.harga,
            isHargaReadonly: row.type === "jasa",
            diskonPersen: 0,
            diskonRp: 0,
            total: row.total,
            barcode: "",
            noSoDtf: "",
            noPengajuanHarga: "",
            pin: "",
            isCustomOrder: row.type === "jasa",
            sod_custom: row.type === "jasa" ? "Y" : "N",
            sod_custom_nama: row.sod_custom_nama || row.nama,
            sod_custom_data: row.sod_custom_data || null,
        }),
    );

    const offerData = {
        shirtLabel: activeShirtLabel.value,
        shirtType: store.currentShirtType,
        shirtColor: store.shirtColor,
        totalQty: totalQty.value,
        grandTotal: grandTotal.value,
        serviceType: selectedService.value,
        serviceLabel: getServiceLabel(selectedService.value),
        designItems: designItems.value.map((item) => ({
            id: item.id,
            side: item.side,
            label: item.label,
            dimensions: `${item.width} × ${item.height} cm`,
            serviceType: item.service,
            serviceLabel: getServiceLabel(item.service),
        })),
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
        items: formattedOfferItems, // Array item siap pakai untuk OfferCreateView.vue
    };

    currentOfferData.value = offerData;
    emit("create-offer", offerData);
    return offerData;
};

const showPenawaranModal = ref(false);
const showLoginModal = ref(false);
const currentOfferData = ref<any>(null);

const handleOpenPenawaranModal = () => {
    if (totalQty.value <= 0) {
        alert("Masukkan jumlah kuantitas pesanan terlebih dahulu.");
        return;
    }
    handleCreateOffer();

    if (!authStore.isLoggedIn) {
        showLoginModal.value = true;
        return;
    }

    showPenawaranModal.value = true;
};

const handleLoginSuccess = () => {
    showPenawaranModal.value = true;
};

const isSharingWhatsapp = ref(false);

const handleSendToWhatsapp = async () => {
    if (totalQty.value <= 0) {
        alert(
            "Masukkan kuantitas pesanan terlebih dahulu sebelum mengirim ke WA Admin.",
        );
        return;
    }

    isSharingWhatsapp.value = true;
    try {
        if (props.canvasRef?.saveCurrentState) {
            props.canvasRef.saveCurrentState();
        }

        const canvasStatePayload = {
            front: store.canvasStates.front,
            back: store.canvasStates.back,
            sizes: {
                S: qtyS.value,
                M: qtyM.value,
                L: qtyL.value,
                XL: qtyXL.value,
                XXL: qtyXXL.value,
                XXXL: qtyXXXL.value,
            },
            totalQty: totalQty.value,
            subtotal: grandTotal.value,
            fabric: store.selectedFabric,
            shirtType: store.currentShirtType,
        };

        const designId = "DSG-" + Date.now().toString(36).toUpperCase();

        const saveRes = await saveMockupDesign({
            id: designId,
            canvasState: JSON.stringify(canvasStatePayload),
            shirtColor: store.shirtColor,
            viewType: store.currentView as any,
        });

        const activeId = saveRes?.id || designId;
        const currentUrl = window.location.origin + window.location.pathname;
        const shareUrl = `${currentUrl}?designId=${activeId}`;

        const shirtLabel =
            activeShirtLabel.value ||
            `${store.selectedFabric} ${store.currentShirtType}`;
        const totalRp = formatRupiah(grandTotal.value);

        const messageText = `Halo Admin KAOSAN, saya mau pesan kaos custom ini:

📌 Kode: ${activeId}
🔗 Workspace: ${shareUrl}
👕 ${totalQty.value} Pcs (${shirtLabel})
💰 Est. Total: ${totalRp}

Mohon dicek workspace & dibuatkan penawarannya. Terima kasih!`;

        const waNumber = "6282138424194";
        // const waNumber = "628123456789";
        const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(messageText)}`;
        window.open(waUrl, "_blank");
    } catch (e: any) {
        console.error("Gagal membagikan ke WA:", e);
        alert("Gagal menyimpan workspace desain: " + (e.message || e));
    } finally {
        isSharingWhatsapp.value = false;
    }
};

// Auto-fill quantity active size atau dari state tersimpan
const setInitialActiveQty = () => {
    const saved = store.orderQuantities || {};
    const s = saved.S ?? 0;
    const m = saved.M ?? 0;
    const l = saved.L ?? 0;
    const xl = saved.XL ?? 0;
    const xxl = saved.XXL ?? 0;
    const xxxl = saved.XXXL ?? 0;

    const hasSavedQty =
        s > 0 || m > 0 || l > 0 || xl > 0 || xxl > 0 || xxxl > 0;

    if (hasSavedQty) {
        qtyS.value = s;
        qtyM.value = m;
        qtyL.value = l;
        qtyXL.value = xl;
        qtyXXL.value = xxl;
        qtyXXXL.value = xxxl;
        syncPrintQties();
        return;
    }

    const size = store.currentSize || "L";
    qtyS.value = 0;
    qtyM.value = 0;
    qtyL.value = 0;
    qtyXL.value = 0;
    qtyXXL.value = 0;
    qtyXXXL.value = 0;

    if (size === "S") {
        qtyS.value = 1;
    } else if (size === "M") {
        qtyM.value = 1;
    } else if (size === "XL") {
        qtyXL.value = 1;
    } else if (size === "XXL") {
        qtyXXL.value = 1;
    } else if (size === "XXXL") {
        qtyXXXL.value = 1;
    } else {
        qtyL.value = 1;
        store.currentSize = "L";
    }
    syncPrintQties();
};

const syncStoreQuantities = () => {
    store.orderQuantities = {
        S: qtyS.value,
        M: qtyM.value,
        L: qtyL.value,
        XL: qtyXL.value,
        XXL: qtyXXL.value,
        XXXL: qtyXXXL.value,
    };
};

// Sync and Cap watchers
watch([qtyS, qtyM, qtyL, qtyXL, qtyXXL, qtyXXXL], () => {
    syncStoreQuantities();
});

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
            setInitialActiveQty();
            detectDesignDimensions();
            generatePreviews();
            fetchBackendKalkulasi();
        }
    },
);

// Sinkronkan kembali dimensi dan kalkulasi saat modal penawaran ditutup/dibatalkan
watch(showPenawaranModal, (isOpen) => {
    if (!isOpen && props.show) {
        detectDesignDimensions();
        fetchBackendKalkulasi();
    }
});
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
                                        2. Jumlah Kaos yang Dicetak/Dibordir
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
                                CETAK/BORDIR
                            </span>
                        </div>

                        <div
                            class="p-4 bg-slate-50 dark:bg-slate-950/40 border border-sky-100/50 dark:border-slate-850 rounded-2xl flex flex-col gap-3.5"
                        >
                            <!-- TAMPILAN PER DESAIN (Jika terdeteksi objek desain) -->
                            <div
                                v-if="designItems.length > 0"
                                class="flex flex-col gap-2.5"
                            >
                                <div
                                    v-for="item in designItems"
                                    :key="item.id"
                                    class="p-3 bg-white dark:bg-slate-900 border border-sky-100/80 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                                >
                                    <div
                                        class="flex items-center gap-2.5 min-w-0"
                                    >
                                        <span
                                            class="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider flex-shrink-0"
                                            :class="
                                                item.side === 'front'
                                                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300'
                                                    : 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300'
                                            "
                                        >
                                            {{
                                                item.side === "front"
                                                    ? "Depan"
                                                    : "Belakang"
                                            }}
                                        </span>
                                        <div class="flex flex-col min-w-0">
                                            <span
                                                class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate"
                                            >
                                                {{ item.label }}
                                            </span>
                                            <span
                                                class="text-[9.5px] text-slate-400 font-mono"
                                            >
                                                {{ item.width }} ×
                                                {{ item.height }} cm ({{
                                                    item.area
                                                }}
                                                cm²)
                                            </span>
                                        </div>
                                    </div>
                                    <div
                                        class="flex items-center gap-2 flex-shrink-0"
                                    >
                                        <label
                                            class="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline"
                                        >
                                            Cetak/Bordir:
                                        </label>
                                        <select
                                            v-model="item.service"
                                            @change="
                                                designServiceMap[item.id] =
                                                    item.service
                                            "
                                            class="px-3 py-1.5 rounded-lg border border-sky-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold focus:ring-1 focus:ring-sky-500 focus:outline-none cursor-pointer"
                                        >
                                            <option value="none">
                                                Tanpa cetak
                                            </option>
                                            <option value="BR">Bordir</option>
                                            <option value="SD">
                                                DTF Standart
                                            </option>
                                            <option value="DP">
                                                DTF Premium
                                            </option>
                                            <option value="TG">DTG</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <!-- FALLBACK: PILIHAN PER SISI JIKA BELUM ADA DESAIN -->
                            <div
                                v-else
                                class="grid grid-cols-1 md:grid-cols-2 gap-4"
                            >
                                <!-- Jenis Jasa Depan -->
                                <div class="flex flex-col gap-1.5">
                                    <label
                                        class="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between"
                                    >
                                        <span>Sisi Depan</span>
                                        <span
                                            v-if="frontDimensions.area > 0"
                                            class="text-sky-500 font-bold font-mono"
                                            >({{ frontDimensions.width }} ×
                                            {{ frontDimensions.height }}
                                            cm)</span
                                        >
                                        <span
                                            v-else
                                            class="text-slate-400 italic font-normal"
                                            >(Kosong)</span
                                        >
                                    </label>
                                    <select
                                        v-model="frontService"
                                        class="px-3 py-2 rounded-xl border border-sky-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold focus:ring-1 focus:ring-sky-500 focus:outline-none cursor-pointer"
                                    >
                                        <option value="none">
                                            Tanpa cetak
                                        </option>
                                        <option value="BR">Bordir</option>
                                        <option value="SD">DTF Standart</option>
                                        <option value="DP">DTF Premium</option>
                                        <option value="TG">DTG</option>
                                    </select>
                                </div>

                                <!-- Jenis Jasa Belakang -->
                                <div class="flex flex-col gap-1.5">
                                    <label
                                        class="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between"
                                    >
                                        <span>Sisi Belakang</span>
                                        <span
                                            v-if="backDimensions.area > 0"
                                            class="text-sky-500 font-bold font-mono"
                                            >({{ backDimensions.width }} ×
                                            {{ backDimensions.height }}
                                            cm)</span
                                        >
                                        <span
                                            v-else
                                            class="text-slate-400 italic font-normal"
                                            >(Kosong)</span
                                        >
                                    </label>
                                    <select
                                        v-model="backService"
                                        class="px-3 py-2 rounded-xl border border-sky-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold focus:ring-1 focus:ring-sky-500 focus:outline-none cursor-pointer"
                                    >
                                        <option value="none">
                                            Tanpa cetak
                                        </option>
                                        <option value="BR">Bordir</option>
                                        <option value="SD">DTF Standart</option>
                                        <option value="DP">DTF Premium</option>
                                        <option value="TG">DTG</option>
                                    </select>
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

                        <!-- Banner Error Backend -->
                        <div
                            v-if="backendError"
                            class="p-3 bg-red-50 dark:bg-red-955/15 border border-red-200/60 dark:border-red-900/40 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-400 font-medium animate-in fade-in duration-200"
                        >
                            <PhInfo
                                :size="16"
                                class="mt-0.5 flex-shrink-0 text-red-500 dark:text-red-400"
                            />
                            <div>
                                <span
                                    class="font-black uppercase text-[9.5px] tracking-wider block mb-0.5 text-red-800 dark:text-red-300"
                                >
                                    Peringatan Sistem
                                </span>
                                {{ backendError }}
                            </div>
                        </div>

                        <div
                            class="relative border border-sky-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-950/20 flex-grow flex flex-col min-h-[150px]"
                        >
                            <!-- Loading Overlay Kalkulasi -->
                            <div
                                v-if="kalkulasiLoading"
                                class="absolute inset-0 bg-white/75 dark:bg-slate-900/75 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-2.5 animate-in fade-in duration-200"
                            >
                                <div
                                    class="relative flex items-center justify-center"
                                >
                                    <div
                                        class="w-8 h-8 rounded-full border-4 border-sky-500/20 border-t-sky-500 animate-spin"
                                    ></div>
                                    <PhCalculator
                                        :size="14"
                                        class="absolute text-sky-500 animate-pulse"
                                    />
                                </div>
                                <span
                                    class="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest animate-pulse"
                                >
                                    Menghitung estimasi harga...
                                </span>
                            </div>
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
                        <div class="flex items-center gap-2.5">
                            <!-- Tombol Buat Penawaran (Unreleased / Soon) -->
                            <button
                                disabled
                                class="px-3.5 py-2 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 text-slate-600 dark:text-slate-350 text-xs font-bold cursor-not-allowed flex items-center gap-2 select-none opacity-85 shadow-xs"
                                type="button"
                                title="Fitur Buat Penawaran sedang dalam tahap integrasi & rilis (Segera Hadir)"
                            >
                                <PhFileText :size="16" class="text-sky-500 shrink-0" />
                                <span>Buat Penawaran</span>
                                <span
                                    class="px-1.5 py-0.5 text-[9px] font-black bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-md uppercase tracking-wider border border-sky-500/20"
                                    >Segera</span
                                >
                            </button>

                            <!-- Tombol Kirim WA Admin (Unreleased / Soon) -->
                            <button
                                disabled
                                class="px-3.5 py-2 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 text-slate-600 dark:text-slate-350 text-xs font-bold cursor-not-allowed flex items-center gap-2 select-none opacity-85 shadow-xs"
                                type="button"
                                title="Fitur Kirim Estimasi ke WA Admin Store sedang dalam integrasi & rilis (Segera Hadir)"
                            >
                                <PhWhatsappLogo
                                    :size="16"
                                    weight="bold"
                                    class="text-emerald-500 shrink-0"
                                />
                                <span>Kirim WA Admin</span>
                                <span
                                    class="px-1.5 py-0.5 text-[9px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md uppercase tracking-wider border border-emerald-500/20"
                                    >Segera</span
                                >
                            </button>

                            <!-- Tombol Tutup Modal -->
                            <button
                                @click="emit('close')"
                                class="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-750 dark:hover:bg-slate-700 text-white text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95"
                                type="button"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- MODAL FORM BUAT PENAWARAN -->
        <PenawaranFormModal
            :isOpen="showPenawaranModal"
            :initialOfferData="currentOfferData"
            @close="showPenawaranModal = false"
        />

        <!-- MODAL QUICK LOGIN ADMIN -->
        <LoginModal
            :isOpen="showLoginModal"
            @close="showLoginModal = false"
            @success="handleLoginSuccess"
        />
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
