<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
    PhX,
    PhPlus,
    PhTrash,
    PhFloppyDisk,
    PhCheckCircle,
    PhUser,
    PhReceipt,
    PhCalendar,
    PhMagnifyingGlass,
    PhSpinner,
    PhPaperPlaneTilt,
    PhCopy,
    PhCheck,
} from "@phosphor-icons/vue";
import {
    savePenawaran,
    fetchLookupCustomers,
    fetchLookupProducts,
} from "../services/api";
import { useAuthStore } from "../stores/authStore";

export interface OfferItem {
    id: number;
    kode: string;
    nama: string;
    kategori: string;
    ukuran: string;
    stok: number;
    jumlah: number;
    harga: number;
    isHargaReadonly?: boolean;
    diskonPersen: number;
    diskonRp: number;
    total: number;
    barcode?: string;
    isCustomOrder?: boolean;
    sod_custom?: string;
    sod_custom_nama?: string;
    sod_custom_data?: string;
}

const props = defineProps<{
    isOpen: boolean;
    initialOfferData?: any;
}>();

const emit = defineEmits<{
    (e: "close"): void;
    (e: "saved", data: any): void;
}>();

const authStore = useAuthStore();

// --- Form State ---
const nomorPenawaran = ref("<Otomatis>");
const tanggalPenawaran = ref(new Date().toISOString().substring(0, 10));
const salesCounter = ref(authStore.user?.nama || "Operator Studio");
const keterangan = ref("");
const ppnPersen = ref(0);
const topDays = ref(0);

// --- Auto Detect Jenis Order & DTF Helpers ---
const autoDetectJenisOrder = () => {
    const customItem = items.value.find(
        (item) =>
            item.kategori === "CUSTOM" ||
            item.isCustomOrder ||
            item.sod_custom === "Y",
    );

    if (customItem) {
        const nameUpper = (customItem.nama || "").toUpperCase();
        const codeUpper = (customItem.kode || "").toUpperCase();

        if (nameUpper.includes("BORDIR") || codeUpper.includes("BR")) {
            return { kode: "BR", nama: "BORDIR" };
        }
        if (nameUpper.includes("POLYFLEX") || codeUpper.includes("PL")) {
            return { kode: "PL", nama: "POLYFLEX" };
        }
        if (
            nameUpper.includes("DTF") ||
            nameUpper.includes("SABLON") ||
            codeUpper.includes("SD") ||
            codeUpper.includes("DP")
        ) {
            return { kode: "SD", nama: "SABLON / DTF" };
        }
        if (
            nameUpper.includes("KERAH") ||
            nameUpper.includes("POLO") ||
            codeUpper.includes("KK")
        ) {
            return { kode: "KK", nama: "KAOS KERAH" };
        }
    }

    const initialService = (
        props.initialOfferData?.serviceType || ""
    ).toUpperCase();
    if (initialService === "SD" || initialService === "DP") {
        return { kode: "SD", nama: "SABLON / DTF" };
    }
    if (initialService === "BR") {
        return { kode: "BR", nama: "BORDIR" };
    }
    if (initialService === "PL") {
        return { kode: "PL", nama: "POLYFLEX" };
    }

    const shirtType = (
        props.initialOfferData?.shirtType || ""
    ).toLowerCase();
    if (shirtType === "polo") {
        return { kode: "KK", nama: "KAOS KERAH" };
    }

    return { kode: "KO", nama: "KAOS OBLONG" };
};

const autoDetectNamaDtf = () => {
    if (props.initialOfferData?.namaDtf) {
        return props.initialOfferData.namaDtf;
    }
    if (props.initialOfferData?.designName) {
        return props.initialOfferData.designName;
    }
    if (props.initialOfferData?.designId) {
        return `DESAIN_${props.initialOfferData.designId}`;
    }

    const firstCustom = items.value.find(
        (item) => item.kategori === "CUSTOM" || item.isCustomOrder,
    );
    if (firstCustom && firstCustom.nama) {
        return `FILE_${firstCustom.nama
            .replace(/[^a-zA-Z0-9]/g, "_")
            .toUpperCase()}`;
    }

    const todayStr = new Date()
        .toISOString()
        .substring(0, 10)
        .replace(/-/g, "");
    return `DESAIN_DTF_${todayStr}`;
};

// --- DP Detail State ---
const dpJenis = ref<"TUNAI" | "TRANSFER" | "GIRO">("TUNAI");
const dpBank = ref("BCA");
const dpNorek = ref("");

// Customer State
const customerKode = ref("");
const customerNama = ref("");
const customerAlamat = ref("");
const customerKota = ref("");
const customerTelp = ref("");
const customerLevel = ref("");

// Customer Lookup Overlay State
const showCustomerLookup = ref(false);
const isSearchingCustomer = ref(false);
const customerSearchResults = ref<any[]>([]);
const customerSearchTotal = ref(0);
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const handleCustomerInput = () => {
    const term = (customerNama.value || "").trim();
    if (term.length < 2) {
        customerSearchResults.value = [];
        showCustomerLookup.value = false;
        return;
    }

    showCustomerLookup.value = true;
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

    searchDebounceTimer = setTimeout(async () => {
        isSearchingCustomer.value = true;
        try {
            const res = await fetchLookupCustomers(term);
            customerSearchResults.value = res.items || [];
            customerSearchTotal.value = res.total || 0;
        } catch (err) {
            console.error("Gagal melakukan pencarian customer:", err);
            customerSearchResults.value = [];
        } finally {
            isSearchingCustomer.value = false;
        }
    }, 250);
};

const selectCustomerFromLookup = (cust: any) => {
    customerKode.value = cust.kode || "CUST-GENERAL";
    customerNama.value = cust.nama || "";
    customerTelp.value = cust.telp || "";
    customerLevel.value = cust.levelNama || "Retailer";
    customerAlamat.value = cust.alamat || "";
    customerKota.value = cust.kota || "";
    if (cust.top !== undefined && cust.top !== null) {
        topDays.value = Number(cust.top) || 0;
    }
    showCustomerLookup.value = false;
};

// Gudang
const gudangNama = ref("Gudang Utama (G01)");

// Items
const items = ref<OfferItem[]>([]);

// Product Lookup Modal State
const isProductModalOpen = ref(false);
const activeProductRowIdx = ref<number | null>(null);
const productSearchKeyword = ref("");
const isSearchingProduct = ref(false);
const productSearchResults = ref<any[]>([]);
let productSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const openProductLookupModal = (rowIdx: number) => {
    activeProductRowIdx.value = rowIdx;
    isProductModalOpen.value = true;
    productSearchKeyword.value = items.value[rowIdx]?.kode || "";
    fetchProductList(productSearchKeyword.value);
};

const closeProductLookupModal = () => {
    if (productSearchDebounceTimer) clearTimeout(productSearchDebounceTimer);
    isProductModalOpen.value = false;
    activeProductRowIdx.value = null;
    isSearchingProduct.value = false;
};

const fetchProductList = (keyword: string) => {
    if (productSearchDebounceTimer) clearTimeout(productSearchDebounceTimer);
    isSearchingProduct.value = true;

    productSearchDebounceTimer = setTimeout(async () => {
        try {
            const results = await fetchLookupProducts((keyword || "").trim());
            productSearchResults.value = results || [];
        } catch (err) {
            console.error("Gagal memuat daftar produk:", err);
            productSearchResults.value = [];
        } finally {
            isSearchingProduct.value = false;
        }
    }, 300);
};

const selectProduct = (prod: any) => {
    if (
        activeProductRowIdx.value !== null &&
        activeProductRowIdx.value >= 0 &&
        activeProductRowIdx.value < items.value.length
    ) {
        const item = items.value[activeProductRowIdx.value];
        if (item) {
            item.kode = prod.brg_kode || prod.kode || item.kode;
            item.nama = prod.brg_nama || prod.nama || item.nama;
            item.kategori = prod.brg_kategori || prod.kategori || item.kategori || "REGULER";
            item.ukuran = prod.brgd_ukuran || prod.ukuran || item.ukuran || "-";
            item.stok = Number(prod.brgd_stok ?? prod.stok ?? item.stok ?? 0);
            item.harga = Number(prod.brgd_harga ?? prod.harga ?? item.harga ?? 0);
            item.barcode = prod.brg_barcode || prod.barcode || "";

            updateRowTotal(item);
        }
    }
    closeProductLookupModal();
};

// Financials Summary
const diskonNotaPersen = ref(0);
const diskonNotaRp = ref(0);
const biayaKirim = ref(0);
const dpNominal = ref(0);
const isSubmitting = ref(false);

// Auto calculation for tanggal tempo
const tanggalTempo = computed(() => {
    const d = new Date(tanggalPenawaran.value);
    d.setDate(d.getDate() + Number(topDays.value || 0));
    return d.toISOString().substring(0, 10);
});

// Sync initial data from EstimasiHarga
watch(
    () => props.initialOfferData,
    (newVal) => {
        if (newVal && newVal.items && Array.isArray(newVal.items)) {
            items.value = newVal.items.map((item: any, idx: number) => ({
                id: item.id || Date.now() + idx,
                kode: item.kode || "ITEM",
                nama: item.nama || "Item Pesanan",
                kategori: item.kategori || "REGULER",
                ukuran: item.ukuran || "-",
                stok: item.stok || 0,
                jumlah: Number(item.jumlah || item.qty || 1),
                harga: Number(item.harga || 0),
                isHargaReadonly: item.isHargaReadonly || false,
                diskonPersen: Number(item.diskonPersen || 0),
                diskonRp: Number(item.diskonRp || 0),
                total: Number(item.total || 0),
                barcode: item.barcode || "",
                isCustomOrder: item.isCustomOrder || false,
                sod_custom: item.sod_custom || "N",
                sod_custom_nama: item.sod_custom_nama || item.nama,
                sod_custom_data: item.sod_custom_data || null,
            }));
            recalculateTotals();
        }
    },
    { immediate: true },
);

// Recalculate row total
const updateRowTotal = (item: OfferItem) => {
    const sub = item.jumlah * item.harga;
    let disc = item.diskonRp;
    if (item.diskonPersen > 0) {
        disc = Math.round((sub * item.diskonPersen) / 100);
        item.diskonRp = disc;
    }
    item.total = Math.max(0, sub - disc);
};

const recalculateTotals = () => {
    items.value.forEach((item) => updateRowTotal(item));
};

// Summary Calculations
const subtotalBruto = computed(() => {
    return items.value.reduce((acc, row) => acc + (row.total || 0), 0);
});

const diskonNotaNominal = computed(() => {
    if (diskonNotaPersen.value > 0) {
        return Math.round((subtotalBruto.value * diskonNotaPersen.value) / 100);
    }
    return Number(diskonNotaRp.value || 0);
});

const dppNominal = computed(() => {
    return Math.max(0, subtotalBruto.value - diskonNotaNominal.value);
});

const ppnNominal = computed(() => {
    if (ppnPersen.value > 0) {
        return Math.round((dppNominal.value * ppnPersen.value) / 100);
    }
    return 0;
});

const totalBiayaTambahan = computed(() => {
    return Number(biayaKirim.value || 0);
});

const grandTotal = computed(() => {
    return Math.max(
        0,
        dppNominal.value + ppnNominal.value + totalBiayaTambahan.value,
    );
});

const sisaBayar = computed(() => {
    return Math.max(0, grandTotal.value - Number(dpNominal.value || 0));
});

// Add Manual Row
const handleAddRow = () => {
    const newRowIndex = items.value.length;
    items.value.push({
        id: Date.now(),
        kode: "",
        nama: "",
        kategori: "REGULER",
        ukuran: "-",
        stok: 0,
        jumlah: 1,
        harga: 0,
        diskonPersen: 0,
        diskonRp: 0,
        total: 0,
    });
    openProductLookupModal(newRowIndex);
};

// Remove Row
const handleRemoveRow = (index: number) => {
    items.value.splice(index, 1);
};

// Format Currency Helper
const formatRupiah = (val?: number) => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(val || 0);
};

// Modal Confirmation & Success Dialog States
const showConfirmModal = ref(false);
const showSuccessModal = ref(false);
const pendingPayload = ref<any>(null);
const savedSuccessResult = ref<{
    nomor: string;
    customerNama: string;
    grandTotal: number;
    totalItems: number;
    tanggal: string;
} | null>(null);
const isCopiedNomor = ref(false);

const handleCopyNomor = () => {
    if (savedSuccessResult.value?.nomor) {
        navigator.clipboard.writeText(savedSuccessResult.value.nomor);
        isCopiedNomor.value = true;
        setTimeout(() => {
            isCopiedNomor.value = false;
        }, 2000);
    }
};

// Initiate Save (Opens Confirmation Popup)
const handleSave = (jadikanSo: boolean = false) => {
    if (items.value.length === 0) {
        alert("Tambahkan minimal 1 item produk dalam penawaran.");
        return;
    }

    const autoJenis = autoDetectJenisOrder();
    const autoDtf = autoDetectNamaDtf();

    pendingPayload.value = {
        header: {
            nomor: nomorPenawaran.value,
            tanggal: tanggalPenawaran.value,
            salesCounter: salesCounter.value,
            customerKode: customerKode.value,
            customerNama: customerNama.value || "Pelanggan Umum",
            customerAlamat: customerAlamat.value,
            customerKota: customerKota.value,
            customerTelp: customerTelp.value,
            customerLevel: customerLevel.value,
            top: topDays.value,
            tempo: tanggalTempo.value,
            keterangan: keterangan.value,
            gudang: gudangNama.value,
            ppnPersen: ppnPersen.value,
            jenisOrderKode: autoJenis.kode,
            jenisOrderNama: autoJenis.nama,
            namaDtf: autoDtf,
            dpJenis: dpJenis.value,
            dpBank: dpBank.value,
            dpNorek: dpNorek.value,
            jadikanSo: jadikanSo,
        },
        summary: {
            subtotalBruto: subtotalBruto.value,
            diskonNota: diskonNotaNominal.value,
            dpp: dppNominal.value,
            ppn: ppnNominal.value,
            biayaKirim: biayaKirim.value,
            grandTotal: grandTotal.value,
            dp: dpNominal.value,
            sisaBayar: sisaBayar.value,
        },
        items: items.value,
    };

    showConfirmModal.value = true;
};

// Execute Real Save (Called when user approves in Confirmation Modal)
const executeSavePenawaran = async () => {
    if (!pendingPayload.value) return;

    isSubmitting.value = true;
    try {
        const res = await savePenawaran(pendingPayload.value);
        showConfirmModal.value = false;

        savedSuccessResult.value = {
            nomor: res?.nomor || res?.idrec || "PEN-SUCCESS",
            customerNama: pendingPayload.value.header.customerNama || "Pelanggan",
            grandTotal: pendingPayload.value.summary.grandTotal || 0,
            totalItems: pendingPayload.value.items.length || 0,
            tanggal: pendingPayload.value.header.tanggal || new Date().toISOString().substring(0, 10),
        };

        showSuccessModal.value = true;
    } catch (err: any) {
        console.error("Gagal menyimpan penawaran:", err);
        alert(`Gagal menyimpan penawaran: ${err.message || err}`);
    } finally {
        isSubmitting.value = false;
    }
};

const handleFinishSuccess = () => {
    showSuccessModal.value = false;
    if (pendingPayload.value) {
        emit("saved", pendingPayload.value);
    }
    handleCloseModal();
};

const handleCloseModal = () => {
    isProductModalOpen.value = false;
    showCustomerLookup.value = false;
    activeProductRowIdx.value = null;
    isSearchingProduct.value = false;
    isSearchingCustomer.value = false;
    emit("close");
};

watch(
    () => props.isOpen,
    (val) => {
        if (val) {
            if (authStore.user?.nama) {
                salesCounter.value = authStore.user.nama;
            }
        } else {
            isProductModalOpen.value = false;
            showCustomerLookup.value = false;
            activeProductRowIdx.value = null;
            isSearchingProduct.value = false;
            isSearchingCustomer.value = false;
        }
    },
    { immediate: true },
);
</script>

<template>
    <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/70 backdrop-blur-md p-4 overflow-y-auto"
        @click.self="handleCloseModal"
    >
        <div
            @click.stop
            class="bg-white/95 dark:bg-slate-900/95 rounded-3xl shadow-2xl border border-sky-100 dark:border-slate-800 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden transition-all duration-300"
        >
            <!-- HEADER MODAL -->
            <div
                class="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-sky-100/60 dark:border-slate-800 flex items-center justify-between"
            >
                <div class="flex items-center gap-3">
                    <div
                        class="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 dark:border-sky-400/20"
                    >
                        <PhReceipt :size="22" weight="bold" />
                    </div>
                    <div>
                        <h2
                            class="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100"
                        >
                            Form Penawaran Harga
                        </h2>
                        <p
                            class="text-[11px] text-slate-500 dark:text-slate-400 font-medium"
                        >
                            Terintegrasi dari Estimasi Harga Modul Studio
                        </p>
                    </div>
                </div>
                <button
                    @click="handleCloseModal"
                    class="w-8 h-8 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer"
                    type="button"
                >
                    <PhX :size="18" weight="bold" />
                </button>
            </div>

            <!-- BODY CONTAINER -->
            <div
                class="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800 dark:text-slate-200 custom-scrollbar"
            >
                <!-- SECTION 1: HEADER FORM FIELDS -->
                <div
                    class="grid grid-cols-1 md:grid-cols-3 gap-5 bg-sky-50/30 dark:bg-slate-800/30 p-5 rounded-2xl border border-sky-100/60 dark:border-slate-800/80"
                >
                    <!-- Column 1: Info Transaksi -->
                    <div class="space-y-3">
                        <h3
                            class="text-xs font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5"
                        >
                            <PhReceipt :size="15" /> Detail Transaksi
                        </h3>
                        <div>
                            <label
                                class="text-[11px] font-bold text-slate-500 dark:text-slate-400"
                                >Nomor Penawaran</label
                            >
                            <input
                                v-model="nomorPenawaran"
                                disabled
                                class="w-full mt-1 px-3 py-1.5 text-xs font-semibold bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-500 dark:text-slate-400 cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label
                                class="text-[11px] font-bold text-slate-500 dark:text-slate-400"
                                >Tanggal</label
                            >
                            <input
                                type="date"
                                v-model="tanggalPenawaran"
                                class="w-full mt-1 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500/30 transition-all"
                            />
                        </div>
                        <div>
                            <label
                                class="text-[11px] font-bold text-slate-500 dark:text-slate-400"
                                >Sales Counter</label
                            >
                            <input
                                v-model="salesCounter"
                                disabled
                                placeholder="Terisi otomatis dari user login..."
                                class="w-full mt-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 cursor-not-allowed focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                            />
                        </div>
                    </div>

                    <!-- Column 2: Info Pelanggan -->
                    <div class="space-y-3">
                        <h3
                            class="text-xs font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5"
                        >
                            <PhUser :size="15" /> Data Customer
                        </h3>
                        <div class="relative">
                            <label
                                class="text-[11px] font-bold text-slate-500 dark:text-slate-400"
                                >Nama Customer</label
                            >
                            <div class="relative mt-1">
                                <input
                                    v-model="customerNama"
                                    @input="handleCustomerInput"
                                    @focus="handleCustomerInput"
                                    placeholder="Ketik nama, kode, atau no hp customer..."
                                    class="w-full pl-3 pr-8 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sky-600 dark:text-sky-400 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500/30 transition-all"
                                />
                                <div
                                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                >
                                    <PhSpinner
                                        v-if="isSearchingCustomer"
                                        :size="14"
                                        class="animate-spin text-sky-600"
                                    />
                                    <PhMagnifyingGlass v-else :size="14" />
                                </div>
                            </div>

                            <!-- Overlay Popover Lookup Customer -->
                            <div
                                v-if="showCustomerLookup"
                                @click="showCustomerLookup = false"
                                class="fixed inset-0 z-30 bg-transparent"
                            ></div>

                            <Transition name="fade">
                                <div
                                    v-if="
                                        showCustomerLookup &&
                                        (customerSearchResults.length > 0 ||
                                            isSearchingCustomer)
                                    "
                                    class="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-40 max-h-64 overflow-y-auto p-1.5 space-y-1 text-xs divide-y divide-slate-100 dark:divide-slate-800/60"
                                >
                                    <div
                                        v-if="isSearchingCustomer"
                                        class="px-3 py-2.5 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2"
                                    >
                                        <PhSpinner
                                            :size="13"
                                            class="animate-spin text-sky-600 dark:text-sky-400"
                                        />
                                        <span>Mencari data customer...</span>
                                    </div>
                                    <div
                                        v-for="cust in customerSearchResults"
                                        :key="cust.kode"
                                        @click="selectCustomerFromLookup(cust)"
                                        class="p-2.5 rounded-xl hover:bg-sky-50/80 dark:hover:bg-slate-800/80 cursor-pointer transition-all border-none group"
                                    >
                                        <!-- Row 1: Nama Customer, Kode, & Level Badge -->
                                        <div
                                            class="flex items-center justify-between gap-2"
                                        >
                                            <div
                                                class="font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 text-xs truncate"
                                            >
                                                {{ cust.nama }}
                                                <span
                                                    class="ml-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium"
                                                    >[{{ cust.kode }}]</span
                                                >
                                            </div>
                                            <span
                                                class="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-sky-500/10 dark:bg-sky-400/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 dark:border-sky-400/20 shrink-0"
                                            >
                                                {{
                                                    cust.levelNama || "Retailer"
                                                }}
                                            </span>
                                        </div>

                                        <!-- Row 2: Detail Informasi (Telp, Kota, TOP) -->
                                        <div
                                            class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-600 dark:text-slate-300 font-medium"
                                        >
                                            <span v-if="cust.telp">
                                                <span
                                                    class="text-slate-400 dark:text-slate-500 font-normal"
                                                    >Telp:</span
                                                >
                                                {{ cust.telp }}
                                            </span>
                                            <span v-if="cust.kota">
                                                <span
                                                    class="text-slate-400 dark:text-slate-500 font-normal"
                                                    >Kota:</span
                                                >
                                                {{ cust.kota }}
                                            </span>
                                            <span
                                                v-if="
                                                    cust.top !== undefined &&
                                                    cust.top !== null &&
                                                    Number(cust.top) > 0
                                                "
                                            >
                                                <span
                                                    class="text-slate-400 dark:text-slate-500 font-normal"
                                                    >TOP:</span
                                                >
                                                {{ cust.top }} Hari
                                            </span>
                                        </div>

                                        <!-- Row 3: Alamat Lengkap -->
                                        <div
                                            v-if="cust.alamat"
                                            class="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5"
                                        >
                                            <span
                                                class="font-normal text-slate-400 dark:text-slate-500"
                                                >Alamat:</span
                                            >
                                            {{ cust.alamat }}
                                        </div>
                                    </div>

                                    <!-- Footer info total hasil -->
                                    <div
                                        v-if="customerSearchTotal > 0"
                                        class="px-3 py-1.5 text-[10px] text-slate-400 dark:text-slate-500 text-right font-medium"
                                    >
                                        Menampilkan
                                        {{ customerSearchResults.length }} dari
                                        {{ customerSearchTotal }} customer
                                    </div>
                                </div>
                            </Transition>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label
                                    class="text-[11px] font-bold text-slate-500 dark:text-slate-400"
                                    >No. Telepon / WA</label
                                >
                                <input
                                    v-model="customerTelp"
                                    placeholder="Terisi dari customer terpilih..."
                                    class="w-full mt-1 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                />
                            </div>
                            <div>
                                <label
                                    class="text-[11px] font-bold text-slate-500 dark:text-slate-400"
                                    >Level Customer</label
                                >
                                <input
                                    v-model="customerLevel"
                                    disabled
                                    placeholder="Terisi dari customer terpilih..."
                                    class="w-full mt-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 cursor-not-allowed focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                />
                            </div>
                        </div>
                        <div>
                            <label
                                class="text-[11px] font-bold text-slate-500 dark:text-slate-400"
                                >Alamat</label
                            >
                            <input
                                v-model="customerAlamat"
                                placeholder="Alamat lengkap customer..."
                                class="w-full mt-1 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                            />
                        </div>
                    </div>

                    <!-- Column 3: Pembayaran & Catatan -->
                    <div class="space-y-3">
                        <h3
                            class="text-xs font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5"
                        >
                            <PhCalendar :size="15" /> Syarat & Catatan
                        </h3>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label
                                    class="text-[11px] font-bold text-slate-500 dark:text-slate-400"
                                    >TOP (Hari)</label
                                >
                                <input
                                    type="number"
                                    v-model.number="topDays"
                                    class="w-full mt-1 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500/30 transition-all"
                                />
                            </div>
                            <div>
                                <label
                                    class="text-[11px] font-bold text-slate-500 dark:text-slate-400"
                                    >Jatuh Tempo</label
                                >
                                <input
                                    type="date"
                                    v-model="tanggalTempo"
                                    disabled
                                    class="w-full mt-1 px-3 py-1.5 text-xs font-semibold bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-500 dark:text-slate-400 cursor-not-allowed"
                                />
                            </div>
                        </div>
                        <div>
                            <label
                                class="text-[11px] font-bold text-slate-500 dark:text-slate-400"
                                >Catatan</label
                            >
                            <textarea
                                v-model="keterangan"
                                rows="2"
                                placeholder="Tambahkan catatan..."
                                class="w-full mt-1 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500/30 resize-none transition-all"
                            ></textarea>
                        </div>
                    </div>
                </div>

                <!-- SECTION 2: DETAIL TABEL ITEM PENAWARAN -->
                <div class="space-y-3">
                    <div class="flex items-center justify-between">
                        <h3
                            class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2"
                        >
                            Rincian Item Penawaran ({{ items.length }} Baris)
                        </h3>
                        <button
                            @click="handleAddRow"
                            class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer active:scale-95"
                        >
                            <PhPlus :size="14" /> Tambah Baris
                        </button>
                    </div>

                    <div
                        class="overflow-x-auto rounded-2xl border border-sky-100/80 dark:border-slate-800 shadow-sm bg-white/50 dark:bg-slate-900/50"
                    >
                        <table
                            class="w-full text-xs text-left border-collapse min-w-[750px]"
                        >
                            <thead
                                class="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-extrabold uppercase tracking-wider text-[10px]"
                            >
                                <tr>
                                    <th class="px-3 py-2.5 text-center w-10">
                                        #
                                    </th>
                                    <th class="px-3 py-2.5">Kode</th>
                                    <th class="px-3 py-2.5">
                                        Nama Barang / Jasa
                                    </th>
                                    <th class="px-3 py-2.5 text-center">
                                        Kategori
                                    </th>
                                    <th class="px-3 py-2.5 text-center">
                                        Ukuran
                                    </th>
                                    <th class="px-3 py-2.5 text-center w-20">
                                        Qty
                                    </th>
                                    <th class="px-3 py-2.5 text-right w-28">
                                        Harga Satuan
                                    </th>
                                    <th class="px-3 py-2.5 text-right w-24">
                                        Diskon Rp
                                    </th>
                                    <th class="px-3 py-2.5 text-right w-28">
                                        Total
                                    </th>
                                    <th class="px-3 py-2.5 text-center w-12">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody
                                class="divide-y divide-slate-100 dark:divide-slate-800/80"
                            >
                                <tr v-if="items.length === 0">
                                    <td
                                        colspan="10"
                                        class="px-4 py-8 text-center text-slate-400 italic"
                                    >
                                        Belum ada item penawaran. Klik "Tambah
                                        Baris" untuk memasukkan produk.
                                    </td>
                                </tr>
                                <tr
                                    v-else
                                    v-for="(item, idx) in items"
                                    :key="item.id"
                                    class="hover:bg-sky-50/30 dark:hover:bg-slate-800/40 transition-colors relative"
                                >
                                    <!-- # Index -->
                                    <td
                                        class="px-3 py-2.5 text-center text-slate-400 font-bold"
                                    >
                                        {{ idx + 1 }}
                                    </td>

                                    <!-- Field 1: Kode (Tombol Pemanggil Modal Search Produk) -->
                                    <td class="px-3 py-2.5">
                                        <button
                                            @click="openProductLookupModal(idx)"
                                            type="button"
                                            class="w-full px-2.5 py-1.5 font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-400 rounded-lg text-sky-600 dark:text-sky-400 flex items-center justify-between gap-1 group transition-all text-left"
                                            title="Klik untuk memilih produk dari database"
                                        >
                                            <span class="truncate">{{
                                                item.kode || "PILIH KODE"
                                            }}</span>
                                            <PhMagnifyingGlass
                                                :size="14"
                                                class="text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 shrink-0"
                                            />
                                        </button>
                                    </td>

                                    <!-- Field 2: Nama Barang (READ-ONLY dari BE) -->
                                    <td
                                        class="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-200"
                                    >
                                        {{ item.nama || "-" }}
                                    </td>

                                    <!-- Field 3: Kategori (READ-ONLY dari BE) -->
                                    <td class="px-3 py-2.5 text-center">
                                        <span
                                            class="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border"
                                            :class="
                                                item.kategori === 'CUSTOM'
                                                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                                    : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                                            "
                                        >
                                            {{ item.kategori || "REGULER" }}
                                        </span>
                                    </td>

                                    <!-- Field 4: Ukuran (READ-ONLY dari BE) -->
                                    <td
                                        class="px-3 py-2.5 text-center font-bold text-slate-800 dark:text-white"
                                    >
                                        {{ item.ukuran || "-" }}
                                    </td>

                                    <!-- Field 5: Qty (EDITABLE Input) -->
                                    <td class="px-3 py-2.5 text-center">
                                        <input
                                            type="number"
                                            min="1"
                                            v-model.number="item.jumlah"
                                            @input="updateRowTotal(item)"
                                            class="w-16 px-2 py-1 text-center font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 text-slate-800 dark:text-slate-200 transition-all"
                                        />
                                    </td>

                                    <!-- Field 6: Harga Satuan (READ-ONLY dari BE) -->
                                    <td
                                        class="px-3 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-300"
                                    >
                                        {{ formatRupiah(item.harga) }}
                                    </td>

                                    <!-- Field 7: Diskon Rp (READ-ONLY) -->
                                    <td
                                        class="px-3 py-2.5 text-right text-slate-500 dark:text-slate-400"
                                    >
                                        {{ formatRupiah(item.diskonRp) }}
                                    </td>

                                    <!-- Field 8: Total (READ-ONLY) -->
                                    <td
                                        class="px-3 py-2.5 text-right font-bold text-sky-600 dark:text-sky-400"
                                    >
                                        {{ formatRupiah(item.total) }}
                                    </td>

                                    <!-- Action: Hapus Baris -->
                                    <td class="px-3 py-2.5 text-center">
                                        <button
                                            @click="handleRemoveRow(idx)"
                                            class="p-1.5 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-all cursor-pointer rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                                            type="button"
                                            title="Hapus Baris Ini"
                                        >
                                            <PhTrash :size="16" />
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- SECTION 3: RINGKASAN PEMBAYARAN (FOOTER SUMMARY) -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <!-- Catatan Tambahan -->
                    <div
                        class="bg-sky-50/30 dark:bg-slate-800/30 p-4 rounded-2xl border border-sky-100/60 dark:border-slate-800 text-xs space-y-2 text-slate-500 dark:text-slate-400"
                    >
                        <p class="font-bold text-slate-700 dark:text-slate-200">
                            * Ketentuan Penawaran:
                        </p>
                        <ul class="list-disc list-inside space-y-1">
                            <li>
                                Penawaran ini berlaku selama 14 hari sejak
                                tanggal diterbitkan.
                            </li>
                            <li>
                                Harga sudah disesuaikan dengan jenis bahan kaos
                                dan jasa cetak/bordir terpilih.
                            </li>
                            <li>
                                Pembayaran dapat dilakukan via transfer Bank
                                resmi studio.
                            </li>
                        </ul>
                    </div>

                    <!-- Summary Ringkasan Total -->
                    <div
                        class="bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2.5 text-xs"
                    >
                        <div class="flex justify-between items-center py-1">
                            <span
                                class="font-semibold text-slate-600 dark:text-slate-400"
                                >Subtotal Bruto</span
                            >
                            <span
                                class="font-bold text-slate-900 dark:text-white"
                                >{{ formatRupiah(subtotalBruto) }}</span
                            >
                        </div>
                        <div class="flex justify-between items-center py-1">
                            <span
                                class="font-semibold text-slate-600 dark:text-slate-400"
                                >Diskon Nota (Rp)</span
                            >
                            <input
                                type="number"
                                v-model.number="diskonNotaRp"
                                class="w-32 px-2.5 py-1 text-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-all"
                            />
                        </div>
                        <div class="flex justify-between items-center py-1">
                            <span
                                class="font-semibold text-slate-600 dark:text-slate-400"
                                >Biaya Kirim (Rp)</span
                            >
                            <input
                                type="number"
                                v-model.number="biayaKirim"
                                class="w-32 px-2.5 py-1 text-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-all"
                            />
                        </div>
                        <div
                            class="flex justify-between items-center py-2 border-t border-slate-200 dark:border-slate-700/80 font-black text-sm text-sky-600 dark:text-sky-400"
                        >
                            <span>GRAND TOTAL</span>
                            <span>{{ formatRupiah(grandTotal) }}</span>
                        </div>
                        <div
                            class="flex justify-between items-center py-1.5 bg-sky-50/60 dark:bg-slate-800/70 px-3 rounded-xl border border-sky-100/60 dark:border-slate-750"
                        >
                            <span
                                class="font-semibold text-slate-700 dark:text-slate-300"
                                >Uang Muka (DP)</span
                            >
                            <input
                                type="number"
                                v-model.number="dpNominal"
                                class="w-32 px-2 py-1 text-right font-bold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-all"
                            />
                        </div>

                        <!-- Rincian Metode Setoran DP -->
                        <div
                            v-if="dpNominal > 0"
                            class="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/60 dark:border-emerald-900/50 space-y-2 text-[11px]"
                        >
                            <div class="flex items-center justify-between">
                                <span
                                    class="font-bold text-slate-700 dark:text-slate-300"
                                    >Metode DP:</span
                                >
                                <select
                                    v-model="dpJenis"
                                    class="px-2 py-0.5 font-bold text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-emerald-600 dark:text-emerald-400 focus:outline-none"
                                >
                                    <option value="TUNAI">TUNAI</option>
                                    <option value="TRANSFER">
                                        TRANSFER BANK
                                    </option>
                                    <option value="GIRO">GIRO</option>
                                </select>
                            </div>
                            <div
                                v-if="dpJenis === 'TRANSFER'"
                                class="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-200/40 dark:border-emerald-900/40"
                            >
                                <div>
                                    <label
                                        class="text-[10px] font-semibold text-slate-500"
                                        >Bank Tujuan</label
                                    >
                                    <input
                                        v-model="dpBank"
                                        placeholder="Misal: BCA / MANDIRI"
                                        class="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 text-xs font-semibold"
                                    />
                                </div>
                                <div>
                                    <label
                                        class="text-[10px] font-semibold text-slate-500"
                                        >No. Rekening / Ref</label
                                    >
                                    <input
                                        v-model="dpNorek"
                                        placeholder="Nomor rekening..."
                                        class="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 text-xs font-semibold"
                                    />
                                </div>
                            </div>
                        </div>
                        <div
                            class="flex justify-between items-center py-1 font-bold text-slate-900 dark:text-white"
                        >
                            <span>Sisa Pembayaran</span>
                            <span
                                class="text-emerald-600 dark:text-emerald-400"
                                >{{ formatRupiah(sisaBayar) }}</span
                            >
                        </div>
                    </div>
                </div>
            </div>

            <!-- FOOTER MODAL ACTIONS -->
            <div
                class="px-6 py-4 bg-slate-50/80 dark:bg-slate-900/80 border-t border-sky-100/60 dark:border-slate-800 flex items-center justify-between"
            >
                <button
                    @click="handleCloseModal"
                    class="px-4 py-2 rounded-xl bg-red-400 hover:bg-red-500 text-white text-xs font-bold transition-all cursor-pointer"
                    type="button"
                >
                    Batal
                </button>
                <div class="flex items-center gap-3">
                    <button
                        @click="handleSave(false)"
                        :disabled="isSubmitting"
                        class="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95 flex items-center gap-2 disabled:opacity-50"
                        type="button"
                    >
                        <PhFloppyDisk :size="16" />
                        Simpan Penawaran
                    </button>
                    <button
                        @click="handleSave(true)"
                        :disabled="isSubmitting"
                        class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95 flex items-center gap-2 disabled:opacity-50"
                        type="button"
                    >
                        <PhCheckCircle :size="16" />
                        Simpan & Jadikan SO
                    </button>
                </div>
            </div>
        </div>

        <!-- MODAL SEARCH PRODUK -->
        <Transition name="fade">
            <div
                v-if="isProductModalOpen"
                class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
            >
            <div
                @click.stop
                class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
            >
                <!-- Header Modal -->
                <div
                    class="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30"
                >
                    <div class="flex items-center gap-2.5">
                        <div
                            class="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400"
                        >
                            <PhMagnifyingGlass :size="18" weight="bold" />
                        </div>
                        <div>
                            <h3
                                class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider"
                            >
                                Pilih Produk / Barang
                            </h3>
                            <p
                                class="text-[11px] text-slate-500 dark:text-slate-400"
                            >
                                Cari berdasarkan Kode, Nama Produk, atau Barcode
                            </p>
                        </div>
                    </div>
                    <button
                        @click="closeProductLookupModal"
                        class="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                        type="button"
                    >
                        <PhX :size="18" />
                    </button>
                </div>

                <!-- Search Input Bar -->
                <div
                    class="px-6 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900"
                >
                    <div class="relative">
                        <input
                            v-model="productSearchKeyword"
                            @input="fetchProductList(productSearchKeyword)"
                            placeholder="Ketik kode, nama barang, atau barcode..."
                            class="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-all"
                        />
                        <PhMagnifyingGlass
                            :size="16"
                            class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <PhSpinner
                            v-if="isSearchingProduct"
                            :size="16"
                            class="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-sky-600"
                        />
                    </div>
                </div>

                <!-- Content Area: Table Product Results -->
                <div class="p-6 overflow-y-auto flex-1 space-y-3">
                    <div
                        v-if="isSearchingProduct"
                        class="py-12 text-center text-slate-400 flex flex-col items-center gap-2"
                    >
                        <PhSpinner
                            :size="24"
                            class="animate-spin text-sky-600"
                        />
                        <span class="text-xs font-medium"
                            >Memuat daftar produk...</span
                        >
                    </div>

                    <div
                        v-else-if="productSearchResults.length === 0"
                        class="py-12 text-center text-slate-400 italic text-xs"
                    >
                        Tidak ada produk yang ditemukan. Coba gunakan kata kunci
                        pencarian lain.
                    </div>

                    <div
                        v-else
                        class="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800"
                    >
                        <table class="w-full text-xs text-left border-collapse">
                            <thead
                                class="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-extrabold uppercase tracking-wider text-[10px]"
                            >
                                <tr>
                                    <th class="px-3.5 py-2.5">Kode</th>
                                    <th class="px-3.5 py-2.5">Nama Produk</th>
                                    <th class="px-3.5 py-2.5 text-center">
                                        Ukuran
                                    </th>
                                    <th class="px-3.5 py-2.5 text-right">
                                        Harga Satuan
                                    </th>
                                    <th class="px-3.5 py-2.5 text-center w-20">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody
                                class="divide-y divide-slate-100 dark:divide-slate-800/60"
                            >
                                <tr
                                    v-for="prod in productSearchResults"
                                    :key="
                                        prod.brg_kode + (prod.brgd_ukuran || '')
                                    "
                                    @click="selectProduct(prod)"
                                    class="hover:bg-sky-50/60 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group"
                                >
                                    <td
                                        class="px-3.5 py-2.5 font-mono font-extrabold text-sky-600 dark:text-sky-400"
                                    >
                                        {{ prod.brg_kode }}
                                    </td>
                                    <td
                                        class="px-3.5 py-2.5 font-bold text-slate-800 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400"
                                    >
                                        {{ prod.brg_nama }}
                                    </td>
                                    <td
                                        class="px-3.5 py-2.5 text-center font-bold text-slate-700 dark:text-slate-300"
                                    >
                                        {{ prod.brgd_ukuran || "-" }}
                                    </td>
                                    <td
                                        class="px-3.5 py-2.5 text-right font-extrabold text-slate-800 dark:text-slate-100"
                                    >
                                        {{ formatRupiah(prod.brgd_harga) }}
                                    </td>
                                    <td class="px-3.5 py-2.5 text-center">
                                        <button
                                            @click.stop="selectProduct(prod)"
                                            type="button"
                                            class="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95"
                                        >
                                            Pilih
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Footer Modal -->
                <div
                    class="px-6 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400"
                >
                    <span
                        >Menampilkan
                        <strong>{{ productSearchResults.length }}</strong> item
                        produk</span
                    >
                    <button
                        @click="closeProductLookupModal"
                        class="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                        type="button"
                    >
                        Batal
                    </button>
                </div>
            </div>
        </div>
    </Transition>

        <!-- POPUP 1: KONFIRMASI PENGAJUAN PENAWARAN -->
        <Transition name="fade">
            <div
                v-if="showConfirmModal"
                class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-955/75 backdrop-blur-md p-4"
                @click.self="showConfirmModal = false"
            >
                <div
                    class="bg-white/95 dark:bg-slate-900/95 rounded-3xl shadow-2xl border border-sky-100 dark:border-slate-800 w-full max-w-md overflow-hidden flex flex-col"
                >
                    <div class="p-6 text-center space-y-4">
                        <div
                            class="w-16 h-16 mx-auto rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 dark:border-sky-400/20 flex items-center justify-center shadow-inner"
                        >
                            <PhPaperPlaneTilt :size="32" weight="bold" />
                        </div>

                        <div>
                            <h3
                                class="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-100"
                            >
                                Konfirmasi Penawaran
                            </h3>
                            <p
                                class="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium"
                            >
                                Apakah Anda yakin ingin menyimpan data penawaran
                                ini ke database?
                            </p>
                        </div>

                        <div
                            class="p-4 bg-sky-50/50 dark:bg-slate-800/60 rounded-2xl border border-sky-100 dark:border-slate-750 text-left text-xs space-y-2"
                        >
                            <div class="flex justify-between items-center">
                                <span class="text-slate-500 font-semibold"
                                    >Pelanggan:</span
                                >
                                <span
                                    class="font-bold text-slate-800 dark:text-slate-200"
                                    >{{
                                        pendingPayload?.header?.customerNama
                                    }}</span
                                >
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-slate-500 font-semibold"
                                    >Jumlah Item:</span
                                >
                                <span
                                    class="font-bold text-slate-800 dark:text-slate-200"
                                    >{{ pendingPayload?.items?.length }} Baris</span
                                >
                            </div>
                            <div
                                class="flex justify-between items-center pt-2 border-t border-sky-100 dark:border-slate-700"
                            >
                                <span
                                    class="font-black text-slate-700 dark:text-slate-300"
                                    >Grand Total:</span
                                >
                                <span
                                    class="font-black text-sky-600 dark:text-sky-400 text-sm"
                                    >{{
                                        formatRupiah(
                                            pendingPayload?.summary?.grandTotal || 0,
                                        )
                                    }}</span
                                >
                            </div>
                        </div>
                    </div>

                    <div
                        class="px-6 py-4 bg-slate-50/80 dark:bg-slate-900/80 border-t border-sky-100/60 dark:border-slate-800 flex items-center justify-end gap-3"
                    >
                        <button
                            @click="showConfirmModal = false"
                            :disabled="isSubmitting"
                            class="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
                            type="button"
                        >
                            Batal
                        </button>
                        <button
                            @click="executeSavePenawaran"
                            :disabled="isSubmitting"
                            class="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white text-xs font-black uppercase tracking-wider shadow-md hover:shadow-sky-500/20 transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                            type="button"
                        >
                            <PhSpinner
                                v-if="isSubmitting"
                                :size="16"
                                class="animate-spin"
                            />
                            <PhCheckCircle v-else :size="16" weight="bold" />
                            <span>Ya, Simpan Penawaran</span>
                        </button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- POPUP 2: SERAGAM KETERANGAN SUKSES (SERAGAM DENGAN LOGIN SUKSES) -->
        <Transition name="fade">
            <div
                v-if="showSuccessModal"
                class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-955/80 backdrop-blur-md p-4"
            >
                <div
                    class="bg-white/95 dark:bg-slate-900/95 rounded-3xl shadow-2xl border border-emerald-100/80 dark:border-emerald-900/40 w-full max-w-md overflow-hidden flex flex-col text-center"
                >
                    <div class="p-6 space-y-4">
                        <div
                            class="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shadow-lg shadow-emerald-500/10"
                        >
                            <PhCheckCircle
                                :size="48"
                                weight="fill"
                                class="animate-bounce"
                            />
                        </div>

                        <div>
                            <h2
                                class="text-lg font-black uppercase tracking-wider text-slate-800 dark:text-slate-100"
                            >
                                Penawaran Berhasil Disimpan!
                            </h2>
                            <p
                                class="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold"
                            >
                                Data transaksi telah berhasil masuk ke database MySQL.
                            </p>
                        </div>

                        <div
                            class="p-4 bg-emerald-50/50 dark:bg-slate-800/70 rounded-2xl border border-emerald-100 dark:border-slate-750 text-xs space-y-2.5 text-left"
                        >
                            <div class="flex justify-between items-center">
                                <span class="text-slate-500 font-semibold"
                                    >Nomor Penawaran:</span
                                >
                                <div
                                    class="flex items-center gap-1.5 font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm"
                                >
                                    <span>{{ savedSuccessResult?.nomor }}</span>
                                    <button
                                        @click="handleCopyNomor"
                                        class="p-1 rounded-md hover:bg-emerald-100 dark:hover:bg-slate-700 text-slate-400 hover:text-emerald-600 transition-all cursor-pointer"
                                        title="Salin Nomor Penawaran"
                                    >
                                        <PhCheck
                                            v-if="isCopiedNomor"
                                            :size="14"
                                            class="text-emerald-600"
                                        />
                                        <PhCopy v-else :size="14" />
                                    </button>
                                </div>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-slate-500 font-semibold"
                                    >Pelanggan:</span
                                >
                                <span
                                    class="font-bold text-slate-800 dark:text-slate-200"
                                    >{{ savedSuccessResult?.customerNama }}</span
                                >
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-slate-500 font-semibold"
                                    >Tanggal:</span
                                >
                                <span
                                    class="font-semibold text-slate-700 dark:text-slate-300"
                                    >{{ savedSuccessResult?.tanggal }}</span
                                >
                            </div>
                            <div
                                class="flex justify-between items-center pt-2 border-t border-emerald-200/60 dark:border-slate-700"
                            >
                                <span
                                    class="font-black text-slate-700 dark:text-slate-300"
                                    >Grand Total:</span
                                >
                                <span
                                    class="font-black text-emerald-600 dark:text-emerald-400 text-base"
                                    >{{
                                        formatRupiah(
                                            savedSuccessResult?.grandTotal || 0,
                                        )
                                    }}</span
                                >
                            </div>
                        </div>
                    </div>

                    <div
                        class="px-6 py-4 bg-slate-50/80 dark:bg-slate-900/80 border-t border-emerald-100/60 dark:border-slate-800"
                    >
                        <button
                            @click="handleFinishSuccess"
                            class="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                            type="button"
                        >
                            <PhCheckCircle :size="18" weight="bold" />
                            <span>Selesai & Tutup</span>
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>
