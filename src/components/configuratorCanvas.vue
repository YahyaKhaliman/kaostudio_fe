<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed, nextTick } from "vue";
import { Canvas, IText, FabricImage, FabricObject } from "fabric";
import {
    useConfiguratorStore,
    type ViewType,
    type CanvasViewType,
} from "../stores/configurator";
import { processMockupImage, colorizeMockup } from "../utils/mockupProcessor";
import {
    PhSpinner,
    PhCursorClick,
    PhTrash,
    PhRuler,
    PhPlus,
    PhMinus,
    PhArrowCounterClockwise,
    PhMagnifyingGlass,
} from "@phosphor-icons/vue";

// Kustomisasi visual garis bantu (bounding box) & tombol kontrol Fabric.js agar bertema premium
FabricObject.ownDefaults.borderColor = "#818cf8"; // Indigo-400 lembut
FabricObject.ownDefaults.cornerColor = "#ffffff"; // Bulatan sudut putih bersih
FabricObject.ownDefaults.cornerStrokeColor = "#4f46e5"; // Outline Indigo-600
FabricObject.ownDefaults.cornerStyle = "circle"; // Bulatan modern lingkaran
FabricObject.ownDefaults.transparentCorners = false; // Sudut padat (tidak berongga)
FabricObject.ownDefaults.cornerSize = 8; // Sudut kecil elegan
FabricObject.ownDefaults.borderDashArray = [4, 4]; // Garis seleksi putus-putus yang rapi

// Impor aset gambar kaos polos hasil generasi
import tshirtFrontImg from "../assets/images/tshirtFront.png";
import tshirtBackImg from "../assets/images/tshirtBack.png";
import longTshirtFrontImg from "../assets/images/longTshirtFront.png";
import longTshirtBackImg from "../assets/images/longTshirtBack.png";
import poloFrontImg from "../assets/images/poloFront.png";
import poloBackImg from "../assets/images/poloBack.png";

const shirtImages = {
    tshirt: {
        front: tshirtFrontImg,
        back: tshirtBackImg,
    },
    longTshirt: {
        front: longTshirtFrontImg,
        back: longTshirtBackImg,
    },
    polo: {
        front: poloFrontImg,
        back: poloBackImg,
    },
};

const store = useConfiguratorStore();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let fabricCanvas: Canvas | null = null;

const isProcessing = ref(true);
const currentMockupUrl = ref("");
const selectedObject = ref<any>(null);
const displayedView = ref<ViewType>(store.currentView);
const isFlipping = ref(false);

// State ukuran fisik riil sablon (lebar & tinggi dalam cm)
const selectedObjectDimensions = ref<{ width: number; height: number } | null>(
    null,
);

// State dan Fungsi Zoom Workspace
const zoomScale = ref(1.0);
const isDetailZoomActive = ref(false);
const containerMouseX = ref(50); // Persentase koordinat mouse X
const containerMouseY = ref(50); // Persentase koordinat mouse Y
const isMouseOverContainer = ref(false);

const handleContainerMouseMove = (e: MouseEvent) => {
    if (!isDetailZoomActive.value) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    containerMouseX.value = Math.max(0, Math.min(100, x));
    containerMouseY.value = Math.max(0, Math.min(100, y));
    isMouseOverContainer.value = true;
};

const handleContainerMouseLeave = () => {
    isMouseOverContainer.value = false;
};

const zoomIn = () => {
    isDetailZoomActive.value = false;
    if (zoomScale.value < 2.0) {
        zoomScale.value = parseFloat((zoomScale.value + 0.1).toFixed(1));
    }
};

const zoomOut = () => {
    isDetailZoomActive.value = false;
    if (zoomScale.value > 0.5) {
        zoomScale.value = parseFloat((zoomScale.value - 0.1).toFixed(1));
    }
};

const resetZoom = () => {
    isDetailZoomActive.value = false;
    zoomScale.value = 1.0;
};

// Sinkronisasi ulang koordinat offset mouse Fabric.js saat skala zoom berubah
watch(zoomScale, () => {
    nextTick(() => {
        fabricCanvas?.calcOffset();
    });
});

// Hitung origin pusat zoom dinamis (ke objek aktif atau ke pusat area cetak sablon dada kaos)
const transformOriginStyle = computed(() => {
    // Jika zoom detail aktif, gunakan koordinat mouse
    if (isDetailZoomActive.value) {
        if (isMouseOverContainer.value) {
            return `${containerMouseX.value.toFixed(2)}% ${containerMouseY.value.toFixed(2)}%`;
        } else {
            return "50% 50%"; // Kembali ke tengah jika kursor berada di luar area
        }
    }

    const containerSize = 500;

    if (fabricCanvas) {
        const activeObj = fabricCanvas.getActiveObject();
        if (activeObj) {
            const objCenter = activeObj.getCenterPoint();
            const cTop = canvasTop.value;

            // Posisi X absolut: canvas dipusatkan secara horizontal
            const objX = 250 + (objCenter.x - fabricCanvas.width / 2);
            const objY = cTop + objCenter.y;

            // Ubah koordinat absolut menjadi persentase transform-origin
            const pctX = (objX / containerSize) * 100;
            const pctY = (objY / containerSize) * 100;

            return `${pctX.toFixed(2)}% ${pctY.toFixed(2)}%`;
        }
    }

    // Default: Pusat canvas
    const cTop = canvasTop.value;
    const centerY = ((cTop + canvasHeight.value / 2) / containerSize) * 100;
    return `50% ${centerY.toFixed(2)}%`;
});

// Toggle Zoom Detail Cepat (Langsung 145% zoom ke koordinat mouse yang diarahkan)
const toggleDetailFocus = () => {
    if (isDetailZoomActive.value) {
        isDetailZoomActive.value = false;
        zoomScale.value = 1.0;
    } else {
        isDetailZoomActive.value = true;
        zoomScale.value = 1.45; // Zoom-in langsung ke detail
        // Default awal ke tengah jika belum diarahkan mouse
        containerMouseX.value = 50;
        containerMouseY.value = 50;
    }
};

// Hitung skala visual kaos di layar berdasarkan ukuran terpilih (S, M, L, XL, XXL, XXXL)
// Kita gunakan ukuran L (Lebar dada 51 cm) sebagai ukuran referensi visual 100%
const shirtScale = computed(() => {
    const refWidth = 51;
    const sizeData = store.shirtSizes[store.currentSize];
    return sizeData.width / refWidth;
});

// State untuk tooltip dimensi melayang (koordinat absolut di atas objek terpilih)
const tooltipStyle = ref({
    top: "0px",
    left: "0px",
    display: "none",
});

// Fungsi untuk mengupdate posisi tooltip melayang tepat di tengah atas objek aktif
const updateTooltipPosition = () => {
    if (!fabricCanvas) return;
    const obj = fabricCanvas.getActiveObject();
    if (!obj || displayedView.value === "both") {
        tooltipStyle.value.display = "none";
        return;
    }

    // Ambil koordinat bounding box objek relatif terhadap kanvas Fabric
    const bounds = obj.getBoundingRect();

    // Hitung letak absolut tooltip di atas objek
    const top = bounds.top - 28; // 28px di atas objek
    const left = bounds.left + bounds.width / 2;

    tooltipStyle.value = {
        top: `${top}px`,
        left: `${left}px`,
        display: "block",
    };
};

// Fungsi untuk menghitung dimensi fisik riil sablon berdasarkan skala objek & ukuran kaos aktif
const updateSelectedObjectDimensions = () => {
    if (!fabricCanvas) {
        selectedObjectDimensions.value = null;
        return;
    }
    const obj = fabricCanvas.getActiveObject();
    if (!obj) {
        selectedObjectDimensions.value = null;
        return;
    }

    // Ambil ukuran piksel aktif objek (lebar/tinggi x skala)
    const objW = obj.width * obj.scaleX;
    const objH = obj.height * obj.scaleY;

    // Hitung ukuran fisik riil dalam cm berdasarkan pxPerCm dinamis
    const realW = objW / pxPerCm.value;
    const realH = objH / pxPerCm.value;

    selectedObjectDimensions.value = {
        width: parseFloat(realW.toFixed(1)),
        height: parseFloat(realH.toFixed(1)),
    };
};

// Menangani hapus objek lewat tombol Keyboard (Delete / Backspace)
const handleKeyDown = (e: KeyboardEvent) => {
    // Cegah penghapusan jika pengguna sedang mengetik di input form luar
    const activeEl = document.activeElement as HTMLElement | null;
    if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
            activeEl.tagName === "TEXTAREA" ||
            activeEl.isContentEditable)
    )
        return;

    if (e.key === "Delete" || e.key === "Backspace") {
        // Cegah penghapusan jika pengguna sedang mengedit teks di dalam canvas Fabric
        const activeObj = fabricCanvas?.getActiveObject();
        if (
            activeObj &&
            "isEditing" in activeObj &&
            (activeObj as any).isEditing
        ) {
            return;
        }

        deleteSelected();
        e.preventDefault();
    }
};

// Menyimpan referensi mockup hasil pre-proses secara reaktif
const processedFront = ref<HTMLCanvasElement | null>(null);
const processedBack = ref<HTMLCanvasElement | null>(null);

// Konfigurasi letak dan ukuran area sablon (torso area) pada canvas mockup 500x500px untuk setiap jenis kaos
const shirtTypeConfigs = {
    tshirt: {
        front: { baseTop: 95, pxPerCm: 5.5, sideMargin: 4.0, leftOffset: 0 }, // margin samping 4cm
        back: { baseTop: 50, pxPerCm: 5.5, sideMargin: 4.0, leftOffset: 0 },
    },
    longTshirt: {
        front: { baseTop: 100, pxPerCm: 5.4, sideMargin: 4.0, leftOffset: 0 },
        back: { baseTop: 90, pxPerCm: 5.4, sideMargin: 4.0, leftOffset: 0 },
    },
    polo: {
        front: { baseTop: 110, pxPerCm: 5.4, sideMargin: 4.0, leftOffset: -9 }, // geser 9px ke kiri agar pas di tengah kaos polo yang off-center
        back: { baseTop: 90, pxPerCm: 5.4, sideMargin: 4.0, leftOffset: -9 },
    },
};

const activeShirtConfig = computed(() => {
    const viewKey = (
        displayedView.value === "both" ? "front" : displayedView.value
    ) as "front" | "back";
    return shirtTypeConfigs[store.currentShirtType][viewKey];
});

const pxPerCm = computed(() => activeShirtConfig.value.pxPerCm);

const canvasWidth = computed(() => {
    const sizeData = store.shirtSizes[store.currentSize];
    const margin = activeShirtConfig.value.sideMargin;
    return Math.round((sizeData.width - 2 * margin) * pxPerCm.value);
});

const canvasHeight = computed(() => {
    const sizeData = store.shirtSizes[store.currentSize];
    return Math.round(sizeData.length * pxPerCm.value);
});

const canvasTop = computed(() => {
    const refLength = 71; // L size reference length
    const sizeData = store.shirtSizes[store.currentSize];
    const diff = (refLength - sizeData.length) * pxPerCm.value;
    const baseTop = activeShirtConfig.value.baseTop;
    return Math.round(baseTop + diff * 0.25);
});

// Snap Guideline State
const activeSnapPoint = ref<{ name: string; x: number; y: number } | null>(
    null,
);
let activeSnap: { x: number; y: number; name: string } | null = null;

const getStandardSnapPoints = () => {
    const w = canvasWidth.value;
    const h = canvasHeight.value;
    const type = store.currentShirtType;

    // Titik garis bantu (snap points) yang disendirikan per jenis kaos
    if (type === "tshirt") {
        if (displayedView.value === "front") {
            return [
                { name: "Tengah Dada", x: w / 2.1, y: h * 0.15 },
                { name: "Dada Kanan", x: w * 0.21, y: h * 0.15 },
                { name: "Dada Kiri", x: w * 0.75, y: h * 0.15 },
                { name: "Bawah Kiri", x: w * 0.8, y: h * 0.8 },
                { name: "Bawah Kanan", x: w * 0.21, y: h * 0.8 },
                { name: "Tengah Kaos", x: w / 2.1, y: h / 2.2 },
            ];
        } else {
            return [
                { name: "Belakang Tengah", x: w / 2, y: h / 2.5 },
                { name: "Belakang Tengah Atas", x: w / 2, y: h * 0.05 },
                { name: "Belakang Tengah Bawah", x: w / 2, y: h * 0.8 },
            ];
        }
    } else if (type === "longTshirt") {
        if (displayedView.value === "front") {
            return [
                { name: "Tengah Dada", x: w / 2.1, y: h * 0.15 },
                { name: "Dada Kanan", x: w * 0.2, y: h * 0.15 },
                { name: "Dada Kiri", x: w * 0.77, y: h * 0.15 },
                { name: "Bawah Kiri", x: w * 0.8, y: h * 0.8 },
                { name: "Bawah Kanan", x: w * 0.21, y: h * 0.8 },
                { name: "Tengah Kaos", x: w / 2.1, y: h / 2.2 },
            ];
        } else {
            return [
                { name: "Belakang Tengah", x: w / 2.1, y: h / 2.5 },
                { name: "Belakang Tengah Atas", x: w / 2.1, y: h * 0.05 },
                { name: "Belakang Tengah Bawah", x: w / 2.1, y: h * 0.8 },
            ];
        }
    } else if (type === "polo") {
        if (displayedView.value === "front") {
            return [
                { name: "Tengah Dada", x: w / 1.9, y: h * 0.2 },
                { name: "Dada Kiri", x: w * 0.83, y: h * 0.18 },
                { name: "Dada Kanan", x: w * 0.24, y: h * 0.18 },
                { name: "Bawah Kiri", x: w * 0.83, y: h * 0.8 },
                { name: "Bawah Kanan", x: w * 0.24, y: h * 0.8 },
                { name: "Tengah Kaos", x: w / 1.9, y: h / 2.2 },
            ];
        } else {
            return [
                { name: "Belakang Tengah", x: w / 1.9, y: h / 2.5 },
                { name: "Belakang Tengah Atas", x: w / 1.9, y: h * 0.05 },
                { name: "Belakang Tengah Bawah", x: w / 1.9, y: h * 0.8 },
            ];
        }
    }

    // Default fallback jika jenis tidak cocok
    return [];
};

// Menghitung warna mockup secara statis untuk tampak depan dan belakang
const frontMockupUrl = computed(() => {
    if (processedFront.value) {
        let tagBox = undefined;
        if (store.currentShirtType === "tshirt") {
            tagBox = { left: 0.6645, top: 0.88, width: 0.0255, height: 0.0255 };
        } else if (store.currentShirtType === "longTshirt") {
            tagBox = { left: 0.696, top: 0.907, width: 0.0255, height: 0.025 };
        } else if (store.currentShirtType === "polo") {
            tagBox = {
                left: 0.6825,
                top: 0.9253,
                width: 0.0261,
                height: 0.0251,
            };
        }
        return colorizeMockup(processedFront.value, store.shirtColor, tagBox);
    }
    return shirtImages[store.currentShirtType].front;
});

const backMockupUrl = computed(() => {
    if (processedBack.value) {
        return colorizeMockup(processedBack.value, store.shirtColor);
    }
    return shirtImages[store.currentShirtType].back;
});

// Fungsi helper untuk menghitung area cetak dengan ukuran fleksibel (untuk mode preview 320px)
const getPrintableAreaStyle = (view: "front" | "back", size: number) => {
    const scale = size / 500;
    const sizeData = store.shirtSizes[store.currentSize];
    const config = shirtTypeConfigs[store.currentShirtType][view];
    const pcm = config.pxPerCm;

    const margin = config.sideMargin;

    // Visual width & height berdasarkan skala kaos
    const cWidth = Math.round((sizeData.width - 2 * margin) * pcm * scale);
    const cHeight = Math.round(sizeData.length * pcm * scale);

    const refLength = 71;
    const diff = (refLength - sizeData.length) * pcm;
    const cTop = Math.round((config.baseTop + diff * 0.25) * scale);
    const offset = Math.round((config.leftOffset || 0) * scale);

    return {
        top: `${cTop}px`,
        left: `calc(50% + ${offset}px)`,
        transform: "translateX(-50%)",
        width: `${cWidth}px`,
        height: `${cHeight}px`,
        position: "absolute" as const,
    };
};

// Menghitung gaya letak area sablon di UI secara absolute
const printableAreaStyle = computed(() => {
    const offset = activeShirtConfig.value.leftOffset || 0;
    return {
        position: "absolute" as const,
        top: `${canvasTop.value}px`,
        left: `calc(50% + ${offset}px)`,
        transform: "translateX(-50%)",
        width: `${canvasWidth.value}px`,
        height: `${canvasHeight.value}px`,
    };
});

// Melakukan pre-proses gambar kaos untuk memuat gambar transparan ke canvas
const initMockupImages = async () => {
    try {
        isProcessing.value = true;
        const images = shirtImages[store.currentShirtType];
        processedFront.value = await processMockupImage(images.front);
        processedBack.value = await processMockupImage(images.back);
        updateMockupColor();
    } catch (error) {
        console.error("Gagal memproses gambar mockup:", error);
    } finally {
        isProcessing.value = false;
    }
};

// Memperbarui warna kaos secara dinamis berdasarkan state store
const updateMockupColor = () => {
    if (displayedView.value === "front" && processedFront.value) {
        let tagBox = undefined;
        if (store.currentShirtType === "tshirt") {
            tagBox = { left: 0.6645, top: 0.88, width: 0.0255, height: 0.0255 };
        } else if (store.currentShirtType === "longTshirt") {
            tagBox = { left: 0.696, top: 0.907, width: 0.0255, height: 0.025 };
        } else if (store.currentShirtType === "polo") {
            tagBox = {
                left: 0.6825,
                top: 0.9253,
                width: 0.0261,
                height: 0.0251,
            };
        }
        currentMockupUrl.value = colorizeMockup(
            processedFront.value,
            store.shirtColor,
            tagBox,
        );
    } else if (displayedView.value === "back" && processedBack.value) {
        currentMockupUrl.value = colorizeMockup(
            processedBack.value,
            store.shirtColor,
        );
    }
};

// Menginisialisasi Fabric.js Canvas
const initFabricCanvas = () => {
    if (!canvasRef.value) return;

    fabricCanvas = new Canvas(canvasRef.value, {
        width: canvasWidth.value,
        height: canvasHeight.value,
        preserveObjectStacking: true,
        backgroundColor: "transparent",
    });

    // Gambar garis bantu snap secara dinamis setelah render canvas
    fabricCanvas.on("after:render", () => {
        if (!activeSnap) return;
        const ctx = fabricCanvas!.getContext();
        ctx.save();
        ctx.strokeStyle = "#10b981"; // Emerald-500
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        // Garis horizontal melewati snap point
        ctx.beginPath();
        ctx.moveTo(0, activeSnap.y);
        ctx.lineTo(fabricCanvas!.width, activeSnap.y);
        ctx.stroke();

        // Garis vertikal melewati snap point
        ctx.beginPath();
        ctx.moveTo(activeSnap.x, 0);
        ctx.lineTo(activeSnap.x, fabricCanvas!.height);
        ctx.stroke();

        ctx.restore();
    });

    // Daftarkan listener event untuk mendeteksi objek yang dipilih
    initCanvasEvents();
};

// Fungsi untuk mengekspor desain sablon transparan saat ini dan menyimpannya di store
const updateDesignPreviews = () => {
    if (!fabricCanvas) return;
    const dataUrl = fabricCanvas.toDataURL({
        format: "png",
        multiplier: 1,
    });

    const objectsCount = fabricCanvas.getObjects().length;
    const isDirty = objectsCount > 0;

    if (displayedView.value === "front") {
        store.frontDesignUrl = dataUrl;
        store.isFrontDirty = isDirty;
    } else if (displayedView.value === "back") {
        store.backDesignUrl = dataUrl;
        store.isBackDirty = isDirty;
    }

    // Pemicu auto-save setiap kali ada modifikasi kanvas
    store.saveToLocalStorage();
};

const initCanvasEvents = () => {
    if (!fabricCanvas) return;

    const updateSelectedObject = () => {
        selectedObject.value = fabricCanvas?.getActiveObject() || null;
        updateSelectedObjectDimensions();
        updateTooltipPosition();
    };

    fabricCanvas.on("selection:created", updateSelectedObject);
    fabricCanvas.on("selection:updated", updateSelectedObject);
    fabricCanvas.on("selection:cleared", () => {
        selectedObject.value = null;
        selectedObjectDimensions.value = null;
        tooltipStyle.value.display = "none";
        activeSnapPoint.value = null;
        activeSnap = null;
    });

    // Sinkronisasi posisi tooltip melayang & logika snap magnetis saat objek digeser
    fabricCanvas.on("object:moving", (e) => {
        updateTooltipPosition();

        const obj = e.target;
        if (!obj) return;

        const objCenter = obj.getCenterPoint();
        const snapPoints = getStandardSnapPoints();
        const threshold = 12; // snap threshold in px

        let snapped = false;

        for (const point of snapPoints) {
            const dx = objCenter.x - point.x;
            const dy = objCenter.y - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < threshold) {
                // Lock ke snap point
                obj.set({
                    left: point.x,
                    top: point.y,
                    originX: "center",
                    originY: "center",
                });
                obj.setCoords();

                activeSnapPoint.value = {
                    name: point.name,
                    x: point.x,
                    y: point.y,
                };
                activeSnap = { x: point.x, y: point.y, name: point.name };
                snapped = true;
                break;
            }
        }

        if (!snapped) {
            activeSnapPoint.value = null;
            activeSnap = null;
        }

        fabricCanvas!.renderAll();
    });

    fabricCanvas.on("object:scaling", () => {
        updateTooltipPosition();
        updateSelectedObjectDimensions();
    });
    fabricCanvas.on("object:rotating", updateTooltipPosition);

    // Dapatkan preview desain baru setiap kali kanvas dimanipulasi
    fabricCanvas.on("object:added", updateDesignPreviews);
    fabricCanvas.on("object:modified", () => {
        updateDesignPreviews();
        updateSelectedObjectDimensions();
        updateTooltipPosition();
        activeSnapPoint.value = null;
        activeSnap = null;
        fabricCanvas!.renderAll();
    });
    fabricCanvas.on("object:removed", updateDesignPreviews);
};

// Menyimpan state kanvas saat ini ke Pinia beserta dimensi kanvas aktif untuk sinkronisasi proporsional
const saveCurrentState = () => {
    if (fabricCanvas && displayedView.value !== "both") {
        const stateObj = {
            json: fabricCanvas.toJSON(),
            canvasWidth: fabricCanvas.width,
            canvasHeight: fabricCanvas.height,
            pxPerCm: pxPerCm.value,
        };
        store.saveCanvasState(displayedView.value, stateObj);
        store.saveToLocalStorage(); // Simpan perubahan ke LocalStorage
    }
};

// Memuat state kanvas untuk view tertentu dari Pinia dengan penyesuaian dimensi otomatis
const loadStateForView = async (view: "front" | "back") => {
    if (!fabricCanvas) return;

    // Hapus semua objek
    fabricCanvas.clear();

    const savedData = store.canvasStates[view];
    if (savedData) {
        try {
            // Kompatibilitas mundur jika ada format lama yang hanya berupa JSON mentah Fabric.js
            const hasWrapper =
                savedData &&
                typeof savedData === "object" &&
                "json" in savedData;
            const jsonState = hasWrapper ? savedData.json : savedData;

            await fabricCanvas.loadFromJSON(jsonState);

            // Jika ada metadata dimensi kanvas tersimpan dan berbeda dengan dimensi saat ini,
            // lakukan penskalaan letak dan ukuran objek agar tetap presisi
            if (hasWrapper && savedData.canvasWidth && savedData.canvasHeight) {
                const oldW = savedData.canvasWidth;
                const oldH = savedData.canvasHeight;
                const newW = fabricCanvas.width;
                const newH = fabricCanvas.height;

                if (oldW !== newW || oldH !== newH) {
                    const scaleX = newW / oldW;
                    const scaleY = newH / oldH;
                    
                    const oldPxPerCm = savedData.pxPerCm || pxPerCm.value;
                    const newPxPerCm = pxPerCm.value;
                    const objScaleFactor = newPxPerCm / oldPxPerCm;

                    fabricCanvas.getObjects().forEach((obj) => {
                        obj.set({
                            left: obj.left * scaleX,
                            top: obj.top * scaleY,
                            scaleX: obj.scaleX * objScaleFactor,
                            scaleY: obj.scaleY * objScaleFactor,
                        });
                        obj.setCoords();
                    });
                }
            }

            fabricCanvas.renderAll();
        } catch (e) {
            console.error("Gagal memuat state kanvas:", e);
        }
    }

    // Perbarui preview desain statis setelah memuat state
    updateDesignPreviews();
};

// Mengubah ukuran kanvas saat berpindah sisi kaos
const resizeCanvas = (view: "front" | "back") => {
    if (!fabricCanvas) return;

    // Hitung dimensi baru berdasarkan view dan size terpilih
    const sizeData = store.shirtSizes[store.currentSize];
    const config = shirtTypeConfigs[store.currentShirtType][view];
    const pcm = config.pxPerCm;
    const margin = config.sideMargin;
    const newWidth = Math.round((sizeData.width - 2 * margin) * pcm);
    const newHeight = Math.round(sizeData.length * pcm);

    const oldWidth = fabricCanvas.width;
    const oldHeight = fabricCanvas.height;

    fabricCanvas.setDimensions({
        width: newWidth,
        height: newHeight,
    });

    // Scale object positions proportionally jika ada perubahan ukuran
    if (
        oldWidth &&
        oldHeight &&
        (oldWidth !== newWidth || oldHeight !== newHeight)
    ) {
        const scaleX = newWidth / oldWidth;
        const scaleY = newHeight / oldHeight;

        fabricCanvas.getObjects().forEach((obj) => {
            obj.set({
                left: obj.left * scaleX,
                top: obj.top * scaleY,
            });
            obj.setCoords();
        });
    }

    fabricCanvas.renderAll();
};

// Watcher untuk mendeteksi perubahan sisi kaos dengan efek flip 3D
watch(
    () => store.currentView,
    async (newView, oldView) => {
        // Simpan state kanvas untuk view lama (oldView) sebelum diubah
        if (oldView && oldView !== "both") {
            if (fabricCanvas) {
                const stateObj = {
                    json: fabricCanvas.toJSON(),
                    canvasWidth: fabricCanvas.width,
                    canvasHeight: fabricCanvas.height,
                    pxPerCm: pxPerCm.value,
                };
                store.saveCanvasState(oldView, stateObj);
                // Perbarui preview transparan di store agar saat mode 'both' dirender, preview terbarunya langsung muncul
                updateDesignPreviews();
            }
        }

        isFlipping.value = true;

        if (newView === "both") {
            // Jika berpindah ke mode preview berdampingan, ubah displayedView dan lewati resize/load kanvas Fabric
            setTimeout(() => {
                displayedView.value = "both";
            }, 300);

            setTimeout(() => {
                isFlipping.value = false;
            }, 600);
            return;
        }

        // Jeda 300ms (di tengah putaran 90 derajat) untuk memperbarui tampilan
        setTimeout(async () => {
            displayedView.value = newView;
            updateMockupColor();
            resizeCanvas(newView);
            await loadStateForView(newView);

            // Bersihkan seleksi objek
            if (fabricCanvas) {
                fabricCanvas.discardActiveObject();
                fabricCanvas.renderAll();
                selectedObject.value = null;
            }
        }, 300);

        // Selesaikan animasi flipping setelah 600ms
        setTimeout(() => {
            isFlipping.value = false;
        }, 600);
    },
);

// Watcher untuk mendeteksi perubahan warna kaos
watch(
    () => store.shirtColor,
    () => {
        updateMockupColor();
        store.saveToLocalStorage(); // Simpan warna baru ke LocalStorage
    },
);

// Watcher untuk mendeteksi perubahan latar belakang mockup
watch(
    [
        () => store.backdropType,
        () => store.backdropColor,
        () => store.customBackdropUrl,
    ],
    () => {
        store.saveToLocalStorage(); // Simpan konfigurasi backdrop ke LocalStorage
    },
);

// Watcher untuk mendeteksi perubahan ukuran kaos agar mengupdate dimensi fisik sablon, ukuran canvas, dan skala objek
watch(
    () => store.currentSize,
    () => {
        updateSelectedObjectDimensions();
        nextTick(() => {
            updateTooltipPosition();
        });

        if (fabricCanvas) {
            const oldWidth = fabricCanvas.width;
            const oldHeight = fabricCanvas.height;
            const newWidth = canvasWidth.value;
            const newHeight = canvasHeight.value;

            fabricCanvas.setDimensions({
                width: newWidth,
                height: newHeight,
            });

            // Skalakan letak koordinat dan ukuran objek secara proporsional
            if (
                oldWidth &&
                oldHeight &&
                (oldWidth !== newWidth || oldHeight !== newHeight)
            ) {
                const scaleX = newWidth / oldWidth;
                const scaleY = newHeight / oldHeight;
                const objScaleFactor = 1.0; // Ukuran fisik gambar/teks tetap konstan sewaktu mengganti ukuran kaos

                fabricCanvas.getObjects().forEach((obj) => {
                    obj.set({
                        left: obj.left * scaleX,
                        top: obj.top * scaleY,
                        scaleX: obj.scaleX * objScaleFactor,
                        scaleY: obj.scaleY * objScaleFactor,
                    });
                    obj.setCoords();
                });
            }
            fabricCanvas.renderAll();
            // Simpan state aktif yang baru ter-scale agar tersinkronisasi di store
            saveCurrentState();
            updateDesignPreviews();
        }
    },
);

// Watcher untuk mendeteksi perubahan jenis kaos agar menyesuaikan gambar mockup, ukuran kanvas, dan skala objek
watch(
    () => store.currentShirtType,
    async (newType, oldType) => {
        const viewKey = (displayedView.value === "both" ? "front" : displayedView.value) as "front" | "back";
        const oldConfig = shirtTypeConfigs[oldType][viewKey];
        const oldPxPerCm = oldConfig ? oldConfig.pxPerCm : pxPerCm.value;

        await initMockupImages();
        if (fabricCanvas) {
            const oldWidth = fabricCanvas.width;
            const oldHeight = fabricCanvas.height;
            const newWidth = canvasWidth.value;
            const newHeight = canvasHeight.value;

            fabricCanvas.setDimensions({
                width: newWidth,
                height: newHeight,
            });

            // Skalakan objek secara proporsional sesuai dengan karakteristik kanvas kaos baru
            if (
                oldWidth &&
                oldHeight &&
                (oldWidth !== newWidth || oldHeight !== newHeight)
            ) {
                const scaleX = newWidth / oldWidth;
                const scaleY = newHeight / oldHeight;
                
                const newPxPerCm = pxPerCm.value;
                const objScaleFactor = newPxPerCm / oldPxPerCm;

                fabricCanvas.getObjects().forEach((obj) => {
                    obj.set({
                        left: obj.left * scaleX,
                        top: obj.top * scaleY,
                        scaleX: obj.scaleX * objScaleFactor,
                        scaleY: obj.scaleY * objScaleFactor,
                    });
                    obj.setCoords();
                });
            }
            fabricCanvas.renderAll();
            // Simpan state baru yang ter-scale
            saveCurrentState();
            updateDesignPreviews();
        }
        store.saveToLocalStorage();
    },
);

// Inisialisasi awal saat komponen dipasang
onMounted(async () => {
    store.loadFromLocalStorage(); // Muat status dari local storage terlebih dahulu sebelum inisialisasi kanvas
    initFabricCanvas();
    await initMockupImages();
    window.addEventListener("keydown", handleKeyDown);
});

// Simpan state sebelum dihancurkan
onUnmounted(() => {
    saveCurrentState();
    window.removeEventListener("keydown", handleKeyDown);
    if (fabricCanvas) {
        fabricCanvas.dispose();
        fabricCanvas = null;
    }
});

// ==========================================
// FUNGSI MANIPULASI OBJEK FABRIC (EXPOSED)
// ==========================================

const addText = (textVal: string, color = "#000000", fontFamily = "Inter") => {
    if (!fabricCanvas) return;

    const text = new IText(textVal, {
        left: fabricCanvas.width / 2,
        top: fabricCanvas.height / 2,
        originX: "center",
        originY: "center",
        fontSize: 24,
        fill: color,
        fontFamily: fontFamily,
        editable: true,
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll();
};

const addImage = (source: File | string) => {
    if (!fabricCanvas) return;

    const loadAndAddToCanvas = (url: string) => {
        const imgEl = new Image();
        imgEl.onload = () => {
            const fabricImg = new FabricImage(imgEl, {
                left: fabricCanvas!.width / 2,
                top: fabricCanvas!.height / 2,
                originX: "center",
                originY: "center",
            });

            // Hitung skala agar tidak terlalu besar
            const maxW = 120;
            const maxH = 120;
            let scale = 1;
            if (fabricImg.width! > maxW || fabricImg.height! > maxH) {
                scale = Math.min(
                    maxW / fabricImg.width!,
                    maxH / fabricImg.height!,
                );
            }

            fabricImg.set({
                scaleX: scale,
                scaleY: scale,
            });

            fabricCanvas!.add(fabricImg);
            fabricCanvas!.setActiveObject(fabricImg);
            fabricCanvas!.renderAll();
        };
        imgEl.src = url;
    };

    if (typeof source === "string") {
        loadAndAddToCanvas(source);
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            const url = e.target?.result as string;
            loadAndAddToCanvas(url);
        };
        reader.readAsDataURL(source);
    }
};

const deleteSelected = () => {
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject) return;

    // Jika objek yang aktif berupa seleksi grup (multi-select)
    if (activeObject.type === "activeSelection") {
        const activeSelection = activeObject as any;
        const objectsInSelection = activeSelection.getObjects();
        if (objectsInSelection.length > 0) {
            // Hapus hanya satu objek terakhir dalam seleksi grup tersebut
            const targetObj = objectsInSelection[objectsInSelection.length - 1];
            fabricCanvas.remove(targetObj);
        }
    } else {
        // Hapus objek tunggal aktif
        fabricCanvas.remove(activeObject);
    }

    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
};

const bringToFront = () => {
    const obj = fabricCanvas?.getActiveObject();
    if (obj && fabricCanvas) {
        fabricCanvas.bringObjectToFront(obj);
        fabricCanvas.renderAll();
    }
};

const sendToBack = () => {
    const obj = fabricCanvas?.getActiveObject();
    if (obj && fabricCanvas) {
        fabricCanvas.sendObjectToBack(obj);
        fabricCanvas.renderAll();
    }
};

// Fungsi pembantu untuk memproduksi data URL cetak transparan secara dinamis untuk view tertentu dengan penskalaan ekspor
const getPrintDataUrl = async (view: "front" | "back"): Promise<string> => {
    if (displayedView.value === view && fabricCanvas) {
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
        return fabricCanvas.toDataURL({
            format: "png",
            multiplier: 4,
        });
    }

    const savedData = store.canvasStates[view];
    if (!savedData) return "";

    return new Promise((resolve) => {
        const tempCanvasEl = document.createElement("canvas");
        const sizeData = store.shirtSizes[store.currentSize];
        const config = shirtTypeConfigs[store.currentShirtType][view];
        const pcm = config.pxPerCm;
        const margin = config.sideMargin;
        const w = Math.round((sizeData.width - 2 * margin) * pcm);
        const h = Math.round(sizeData.length * pcm);
        tempCanvasEl.width = w;
        tempCanvasEl.height = h;

        const tempCanvas = new Canvas(tempCanvasEl, {
            width: w,
            height: h,
            backgroundColor: "transparent",
        });

        // Deteksi pembungkus dimensi
        const hasWrapper =
            savedData && typeof savedData === "object" && "json" in savedData;
        const jsonState = hasWrapper ? savedData.json : savedData;

        tempCanvas
            .loadFromJSON(jsonState)
            .then(() => {
                // Skalakan objek tempCanvas secara fisik jika dimensi tersimpan berbeda dengan dimensi ekspor target
                if (
                    hasWrapper &&
                    savedData.canvasWidth &&
                    savedData.canvasHeight
                ) {
                    const oldW = savedData.canvasWidth;
                    const oldH = savedData.canvasHeight;
                    const newW = w;
                    const newH = h;

                    if (oldW !== newW || oldH !== newH) {
                        const scaleX = newW / oldW;
                        const scaleY = newH / oldH;
                        
                        const oldPxPerCm = savedData.pxPerCm || pcm;
                        const newPxPerCm = pcm;
                        const objScaleFactor = newPxPerCm / oldPxPerCm;

                        tempCanvas.getObjects().forEach((obj) => {
                            obj.set({
                                left: obj.left * scaleX,
                                top: obj.top * scaleY,
                                scaleX: obj.scaleX * objScaleFactor,
                                scaleY: obj.scaleY * objScaleFactor,
                            });
                            obj.setCoords();
                        });
                    }
                }

                tempCanvas.renderAll();
                const dataUrl = tempCanvas.toDataURL({
                    format: "png",
                    multiplier: 4,
                });
                tempCanvas.dispose();
                resolve(dataUrl);
            })
            .catch((err) => {
                console.error("Gagal memuat kanvas temp cetak:", err);
                tempCanvas.dispose();
                resolve("");
            });
    });
};

// Fungsi pembantu untuk menggabungkan dua gambar depan dan belakang secara horizontal
const mergeImagesSideBySide = (
    dataUrl1: string,
    dataUrl2: string,
    isMockup: boolean,
): Promise<string> => {
    return new Promise((resolve) => {
        const img1 = new Image();
        const img2 = new Image();
        let loadedCount = 0;

        const onImageLoad = async () => {
            loadedCount++;
            if (loadedCount === 2) {
                const canvas = document.createElement("canvas");
                const gap = 24; // Jarak horizontal antara depan & belakang
                canvas.width = img1.width + img2.width + gap;
                canvas.height = Math.max(img1.height, img2.height);

                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve("");
                    return;
                }

                if (isMockup) {
                    // Gambar warna/tipe latar belakang terpilih pada canvas gabungan
                    await drawBackdrop(ctx, canvas.width, canvas.height);
                } else {
                    // Untuk sablon transparan, biarkan transparan sepenuhnya
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }

                // Gambar sisi depan di sebelah kiri
                ctx.drawImage(img1, 0, 0);
                // Gambar sisi belakang di sebelah kanan
                ctx.drawImage(img2, img1.width + gap, 0);

                const mimeType =
                    isMockup && store.backdropType !== "checkerboard"
                        ? "image/jpeg"
                        : "image/png";
                const quality = mimeType === "image/jpeg" ? 0.95 : undefined;

                resolve(canvas.toDataURL(mimeType, quality));
            }
        };

        img1.onload = onImageLoad;
        img2.onload = onImageLoad;
        img1.onerror = () => resolve("");
        img2.onerror = () => resolve("");

        img1.src = dataUrl1;
        img2.src = dataUrl2;
    });
};

// Ekspor File Cetak Sablon Saja (Transparan)
const exportPrint = async (
    view: "front" | "back" | "both",
): Promise<{ name: string; dataUrl: string }[]> => {
    saveCurrentState();
    const results: { name: string; dataUrl: string }[] = [];

    if (view === "front") {
        const dataUrl = await getPrintDataUrl("front");
        if (dataUrl) {
            results.push({
                name: `desain-sablon-depan-${Date.now()}.png`,
                dataUrl,
            });
        }
    } else if (view === "back") {
        const dataUrl = await getPrintDataUrl("back");
        if (dataUrl) {
            results.push({
                name: `desain-sablon-belakang-${Date.now()}.png`,
                dataUrl,
            });
        }
    } else if (view === "both") {
        const frontUrl = await getPrintDataUrl("front");
        const backUrl = await getPrintDataUrl("back");
        if (frontUrl && backUrl) {
            const mergedUrl = await mergeImagesSideBySide(
                frontUrl,
                backUrl,
                false,
            );
            if (mergedUrl) {
                results.push({
                    name: `desain-sablon-gabungan-${Date.now()}.png`,
                    dataUrl: mergedUrl,
                });
            }
        } else if (frontUrl) {
            results.push({
                name: `desain-sablon-depan-${Date.now()}.png`,
                dataUrl: frontUrl,
            });
        } else if (backUrl) {
            results.push({
                name: `desain-sablon-belakang-${Date.now()}.png`,
                dataUrl: backUrl,
            });
        }
    }

    return results;
};

// Menghitung gaya latar belakang wadah mockup secara dinamis
const containerBackdropStyle = computed(() => {
    if (store.backdropType === "solid") {
        return { backgroundColor: store.backdropColor };
    } else if (store.backdropType === "custom" && store.customBackdropUrl) {
        return {
            backgroundImage: `url(${store.customBackdropUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
        };
    }
    return {};
});

// Fungsi asinkronus untuk menggambar backdrop pada canvas ekspor
const drawBackdrop = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
): Promise<void> => {
    return new Promise((resolve) => {
        if (store.backdropType === "solid") {
            ctx.fillStyle = store.backdropColor;
            ctx.fillRect(0, 0, w, h);
            resolve();
        } else if (store.backdropType === "gradient") {
            // Efek dinding studio semen bersih (radial gradient terang ke abu-abu netral)
            const grad = ctx.createRadialGradient(
                w / 2,
                h / 2,
                20,
                w / 2,
                h / 2,
                Math.max(w, h) / 1.2,
            );
            grad.addColorStop(0, "#f8fafc"); // Slate-50 (pusat sorotan lampu studio)
            grad.addColorStop(1, "#cbd5e1"); // Slate-300 (tepi dinding studio abu-abu)
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            resolve();
        } else if (store.backdropType === "checkerboard") {
            // Pola catur (checkerboard) diartikan sebagai background transparan penuh (PNG-24).
            // Oleh karena itu, kita tidak menggambar warna latar belakang apa pun agar file ekspor tetap transparan.
            resolve();
        } else if (store.backdropType === "custom" && store.customBackdropUrl) {
            const bgImg = new Image();
            bgImg.crossOrigin = "anonymous";
            bgImg.onload = () => {
                const scale = Math.max(w / bgImg.width, h / bgImg.height);
                const x = (w - bgImg.width * scale) / 2;
                const y = (h - bgImg.height * scale) / 2;
                ctx.drawImage(
                    bgImg,
                    x,
                    y,
                    bgImg.width * scale,
                    bgImg.height * scale,
                );
                resolve();
            };
            bgImg.onerror = () => {
                ctx.fillStyle = "#090d16";
                ctx.fillRect(0, 0, w, h);
                resolve();
            };
            bgImg.src = store.customBackdropUrl;
        } else {
            ctx.fillStyle = "#090d16";
            ctx.fillRect(0, 0, w, h);
            resolve();
        }
    });
};

// Fungsi pembantu untuk memproduksi data URL mockup lengkap secara dinamis untuk view tertentu
const getMockupDataUrl = async (view: "front" | "back"): Promise<string> => {
    let mockupImgSrc = "";
    if (view === "front") {
        mockupImgSrc = frontMockupUrl.value;
    } else {
        mockupImgSrc = backMockupUrl.value;
    }

    const printDataUrl = await getPrintDataUrl(view);

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = async () => {
            // Tentukan dimensi dasar square canvas ekspor agar selalu 1:1 (mencegah distorsi pada gambar non-square)
            const maxDim = Math.max(img.width, img.height);

            const exportCanvas = document.createElement("canvas");
            exportCanvas.width = maxDim;
            exportCanvas.height = maxDim;
            const ctx = exportCanvas.getContext("2d");
            if (!ctx) {
                resolve("");
                return;
            }

            // Gambar warna/tipe latar belakang terpilih pada seluruh canvas square
            await drawBackdrop(ctx, maxDim, maxDim);

            // Hitung posisi drawImage untuk mensimulasikan CSS 'object-contain' di canvas square
            // (menempatkan gambar kaos tepat di tengah secara proporsional)
            const scaleToFit = Math.min(
                maxDim / img.width,
                maxDim / img.height,
            );
            const drawW = img.width * scaleToFit;
            const drawH = img.height * scaleToFit;
            const drawX = (maxDim - drawW) / 2;
            const drawY = (maxDim - drawH) / 2;

            // Gambar kaos di posisi tengah proporsional
            ctx.drawImage(img, drawX, drawY, drawW, drawH);

            const mimeType =
                store.backdropType === "checkerboard"
                    ? "image/png"
                    : "image/jpeg";
            const quality =
                store.backdropType === "checkerboard" ? undefined : 0.95;

            if (printDataUrl) {
                const canvasImg = new Image();
                canvasImg.onload = () => {
                    const scale = maxDim / 500;
                    const config =
                        shirtTypeConfigs[store.currentShirtType][view];
                    const pcm = config.pxPerCm;
                    const sizeData = store.shirtSizes[store.currentSize];

                    // Hitung cWidth dan cHeight murni dari konfigurasi sisi (view) yang sedang diproses
                    const cWidth = Math.round(
                        (sizeData.width - 2 * config.sideMargin) * pcm
                    );
                    const cHeight = Math.round(sizeData.length * pcm);

                    // Hitung cLeft murni dengan leftOffset yang sesuai
                    const offset = config.leftOffset || 0;
                    const cLeft = Math.round((500 - cWidth) / 2 + offset);

                    // Gunakan baseTop & diff yang sesuai dengan view
                    const refLength = 71;
                    const diff = (refLength - sizeData.length) * pcm;
                    const baseTop = config.baseTop;
                    const cTop = Math.round(baseTop + diff * 0.25);

                    ctx.drawImage(
                        canvasImg,
                        cLeft * scale,
                        cTop * scale,
                        cWidth * scale,
                        cHeight * scale,
                    );
                    resolve(exportCanvas.toDataURL(mimeType, quality));
                };
                canvasImg.src = printDataUrl;
            } else {
                resolve(exportCanvas.toDataURL(mimeType, quality));
            }
        };
        img.src = mockupImgSrc;
    });
};

// Ekspor Gambar Mockup Lengkap dengan Kaos
const exportMockup = async (
    view: "front" | "back" | "both",
): Promise<{ name: string; dataUrl: string }[]> => {
    saveCurrentState();
    const results: { name: string; dataUrl: string }[] = [];
    const ext = store.backdropType === "checkerboard" ? "png" : "jpg";

    if (view === "front") {
        const dataUrl = await getMockupDataUrl("front");
        if (dataUrl) {
            results.push({
                name: `mockup-kaosan-depan-${Date.now()}.${ext}`,
                dataUrl,
            });
        }
    } else if (view === "back") {
        const dataUrl = await getMockupDataUrl("back");
        if (dataUrl) {
            results.push({
                name: `mockup-kaosan-belakang-${Date.now()}.${ext}`,
                dataUrl,
            });
        }
    } else if (view === "both") {
        const frontUrl = await getMockupDataUrl("front");
        const backUrl = await getMockupDataUrl("back");
        if (frontUrl && backUrl) {
            const mergedUrl = await mergeImagesSideBySide(
                frontUrl,
                backUrl,
                true,
            );
            if (mergedUrl) {
                results.push({
                    name: `mockup-kaosan-gabungan-${Date.now()}.${ext}`,
                    dataUrl: mergedUrl,
                });
            }
        } else if (frontUrl) {
            results.push({
                name: `mockup-kaosan-depan-${Date.now()}.${ext}`,
                dataUrl: frontUrl,
            });
        } else if (backUrl) {
            results.push({
                name: `mockup-kaosan-belakang-${Date.now()}.${ext}`,
                dataUrl: backUrl,
            });
        }
    }

    return results;
};

const updateSelectedText = (val: string) => {
    if (!fabricCanvas) return;
    const obj = fabricCanvas.getActiveObject();
    if (
        obj &&
        (obj instanceof IText || obj.type === "i-text" || obj.type === "text")
    ) {
        obj.set({ text: val });
        fabricCanvas.renderAll();
    }
};

const updateSelectedColor = (val: string) => {
    if (!fabricCanvas) return;
    const obj = fabricCanvas.getActiveObject();
    if (obj) {
        obj.set({ fill: val });
        fabricCanvas.renderAll();
    }
};

const updateSelectedFont = (val: string) => {
    if (!fabricCanvas) return;
    const obj = fabricCanvas.getActiveObject();
    if (
        obj &&
        (obj instanceof IText || obj.type === "i-text" || obj.type === "text")
    ) {
        obj.set({ fontFamily: val });
        fabricCanvas.renderAll();
    }
};

const updateSelectedFontSize = (val: number) => {
    if (!fabricCanvas) return;
    const obj = fabricCanvas.getActiveObject();
    if (
        obj &&
        (obj instanceof IText || obj.type === "i-text" || obj.type === "text")
    ) {
        obj.set({ fontSize: val });
        fabricCanvas.renderAll();
    }
};

const updateSelectedImageSize = (widthCm: number, heightCm: number) => {
    if (!fabricCanvas) return;
    const obj = fabricCanvas.getActiveObject();
    if (!obj || obj.type !== "image") return;

    const imgW = obj.width;
    const imgH = obj.height;
    if (!imgW || !imgH) return;

    const aspectRatio = imgW / imgH;
    const targetRatio = widthCm / heightCm;

    let targetWidthCm = widthCm;
    let targetHeightCm = heightCm;

    if (aspectRatio > targetRatio) {
        // Gambar landscape, lebar mengikuti batas template
        targetHeightCm = widthCm / aspectRatio;
    } else {
        // Gambar portrait, tinggi mengikuti batas template
        targetWidthCm = heightCm * aspectRatio;
    }

    const targetWidthPx = targetWidthCm * pxPerCm.value;
    const targetHeightPx = targetHeightCm * pxPerCm.value;

    const scaleX = targetWidthPx / imgW;
    const scaleY = targetHeightPx / imgH;

    obj.set({
        scaleX: scaleX,
        scaleY: scaleY,
    });
    obj.setCoords();
    fabricCanvas.renderAll();

    updateSelectedObjectDimensions();
    updateDesignPreviews();
    saveCurrentState();
};

const handleWidthInput = (e: Event) => {
    if (!fabricCanvas) return;
    const target = e.target as HTMLInputElement;
    const val = parseFloat(target.value);
    if (isNaN(val) || val <= 0) return;

    const obj = fabricCanvas.getActiveObject();
    if (!obj) return;

    const imgW = obj.width;
    const imgH = obj.height;
    if (!imgW || !imgH) return;

    const aspectRatio = imgW / imgH;
    const targetHeightCm = val / aspectRatio;

    const targetWidthPx = val * pxPerCm.value;
    const targetHeightPx = targetHeightCm * pxPerCm.value;

    obj.set({
        scaleX: targetWidthPx / imgW,
        scaleY: targetHeightPx / imgH,
    });
    obj.setCoords();
    fabricCanvas.renderAll();

    updateSelectedObjectDimensions();
    updateDesignPreviews();
    saveCurrentState();
};

const handleHeightInput = (e: Event) => {
    if (!fabricCanvas) return;
    const target = e.target as HTMLInputElement;
    const val = parseFloat(target.value);
    if (isNaN(val) || val <= 0) return;

    const obj = fabricCanvas.getActiveObject();
    if (!obj) return;

    const imgW = obj.width;
    const imgH = obj.height;
    if (!imgW || !imgH) return;

    const aspectRatio = imgW / imgH;
    const targetWidthCm = val * aspectRatio;

    const targetWidthPx = targetWidthCm * pxPerCm.value;
    const targetHeightPx = val * pxPerCm.value;

    obj.set({
        scaleX: targetWidthPx / imgW,
        scaleY: targetHeightPx / imgH,
    });
    obj.setCoords();
    fabricCanvas.renderAll();

    updateSelectedObjectDimensions();
    updateDesignPreviews();
    saveCurrentState();
};

const deselectObject = () => {
    if (fabricCanvas) {
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
    }
};

defineExpose({
    addText,
    addImage,
    deleteSelected,
    bringToFront,
    sendToBack,
    exportPrint,
    exportMockup,
    selectedObject,
    fabricCanvas,
    updateSelectedText,
    updateSelectedColor,
    updateSelectedFont,
    updateSelectedFontSize,
    updateSelectedImageSize,
    deselectObject,
});
</script>

<template>
    <div class="flex flex-col items-center justify-center p-2 w-full">
        <!-- Container Mockup Kaos (Mode Edit - Hanya tampil jika bukan mode 'both') -->
        <div
            v-show="store.currentView !== 'both'"
            class="relative w-[500px] h-[500px] rounded-3xl flex items-center justify-center overflow-hidden border border-sky-100 dark:border-slate-800 transition-all duration-300 shadow-lg bg-white dark:bg-slate-900/60 perspective-1000"
            :class="{
                'bg-checkerboard-light': store.backdropType === 'checkerboard',
                'bg-studio-wall': store.backdropType === 'gradient',
            }"
            :style="containerBackdropStyle"
            @mousemove="handleContainerMouseMove"
            @mouseleave="handleContainerMouseLeave"
        >
            <!-- Overlay Loading Proses Background Removal -->
            <div
                v-if="isProcessing"
                class="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-20 flex flex-col items-center justify-center space-y-4 text-slate-700 dark:text-slate-200"
            >
                <PhSpinner
                    class="animate-spin h-10 w-10 text-sky-600"
                    :size="38"
                    weight="bold"
                />
                <span class="text-slate-700 text-sm font-semibold tracking-wide"
                    >Menghapus background mockup...</span
                >
            </div>

            <!-- Pembungkus Kaos + Sablon untuk Efek Flip 3D -->
            <div
                class="absolute inset-0 w-full h-full flex items-center justify-center transform-style-3d pointer-events-none"
                :class="{ 'animate-flip-3d': isFlipping }"
            >
                <!-- Pembungkus Skala Ukuran Kaos (S, M, L, XL, XXL, XXXL) + Zoom Detail -->
                <div
                    class="absolute inset-0 w-full h-full flex items-center justify-center transform-style-3d pointer-events-none transition-all duration-300 ease-out"
                    :style="{
                        transform: `scale(${zoomScale})`,
                        transformOrigin: transformOriginStyle,
                        transition: isDetailZoomActive
                            ? 'transform 0.3s ease-out, transform-origin 0.15s ease-out'
                            : '',
                    }"
                >
                    <!-- Lapisan Kaos Mockup (Dengan filter drop-shadow agar kaos terlihat timbul 3D) -->
                    <img
                        v-if="currentMockupUrl"
                        :src="currentMockupUrl"
                        class="absolute inset-0 w-full h-full object-contain pointer-events-none select-none filter drop-shadow-[0_25px_35px_rgba(0,0,0,0.18)] backface-hidden"
                        :style="{
                            transform: `scale(${shirtScale})`,
                            transformOrigin: '50% 50%',
                        }"
                        alt="Mockup Kaos"
                    />

                    <!-- Area Container Sablon (Invisible — tanpa border/pembatas visual) -->
                    <div
                        class="absolute flex items-center justify-center backface-hidden pointer-events-auto"
                        :style="printableAreaStyle"
                    >
                        <canvas ref="canvasRef"></canvas>

                        <!-- Label Snap Teks Melayang secara Real-Time -->
                        <div
                            v-if="activeSnapPoint"
                            :style="{
                                position: 'absolute',
                                left: `${activeSnapPoint.x}px`,
                                top: `${activeSnapPoint.y}px`,
                                transform:
                                    'translate(-50%, -100%) translateY(-12px)',
                                zIndex: 40,
                            }"
                            class="bg-emerald-500 text-white text-[9px] font-black px-2.5 py-1 rounded-full shadow-md pointer-events-none whitespace-nowrap animate-bounce flex items-center gap-1 border border-emerald-400"
                        >
                            <span
                                class="w-1.5 h-1.5 rounded-full bg-white inline-block"
                            ></span>
                            {{ activeSnapPoint.name }}
                        </div>

                        <!-- Tooltip Dimensi Melayang secara Real-Time -->
                        <div
                            v-if="selectedObject && selectedObjectDimensions"
                            :style="tooltipStyle"
                            class="absolute z-30 -translate-x-1/2 bg-sky-950/95 text-sky-100 text-[8px] font-black font-mono px-2 py-0.5 rounded-md shadow-md border border-sky-400/30 pointer-events-none flex items-center gap-1 backdrop-blur-sm whitespace-nowrap"
                        >
                            <PhRuler :size="10" weight="bold" />
                            <span
                                >{{ selectedObjectDimensions.width }} ×
                                {{ selectedObjectDimensions.height }} cm</span
                            >
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tombol Hapus Melayang untuk Akses Cepat / Layar Sentuh (Light Glassmorphism Red Accent) -->
            <button
                v-if="selectedObject"
                @click="deleteSelected"
                class="absolute top-4 right-4 z-30 bg-white/95 dark:bg-slate-850 hover:bg-red-500 dark:hover:bg-red-650 border border-red-200/60 dark:border-slate-750 hover:border-red-500/30 text-red-600 dark:text-red-450 hover:text-white dark:hover:text-white py-2.5 px-3 rounded-xl shadow-md transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-1.5 backdrop-blur-md group cursor-pointer"
                title="Hapus elemen terpilih (Bisa tekan Delete/Backspace)"
            >
                <PhTrash :size="14" weight="bold" />
                <span class="text-[10px] font-black uppercase tracking-wider"
                    >Hapus Elemen</span
                >
            </button>
        </div>

        <!-- Kontrol Zoom & Fokus Detail di Luar Kanvas (Di bawah agar tidak menghalangi gambar kaos) -->
        <div
            v-if="store.currentView !== 'both'"
            class="mt-4 flex items-center gap-3 bg-white/95 dark:bg-slate-900/95 border border-sky-100 dark:border-slate-800 p-2 rounded-2xl shadow-lg backdrop-blur-md pointer-events-auto"
        >
            <div class="flex items-center gap-1">
                <button
                    @click="zoomOut"
                    class="w-8 h-8 rounded-xl hover:bg-sky-50 dark:hover:bg-slate-850 text-slate-650 dark:text-slate-350 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-all cursor-pointer border border-transparent hover:border-sky-100 dark:hover:border-slate-800"
                    title="Zoom Out"
                >
                    <PhMinus :size="14" weight="bold" />
                </button>
                <span
                    class="text-[10px] font-black font-mono text-slate-700 dark:text-slate-200 min-w-[40px] text-center"
                >
                    {{ Math.round(zoomScale * 100) }}%
                </span>
                <button
                    @click="zoomIn"
                    class="w-8 h-8 rounded-xl hover:bg-sky-50 dark:hover:bg-slate-850 text-slate-650 dark:text-slate-350 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-all cursor-pointer border border-transparent hover:border-sky-100 dark:hover:border-slate-800"
                    title="Zoom In"
                >
                    <PhPlus :size="14" weight="bold" />
                </button>
                <div
                    class="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 mx-1.5"
                ></div>
                <button
                    @click="resetZoom"
                    class="w-8 h-8 rounded-xl hover:bg-sky-50 dark:hover:bg-slate-850 text-slate-500 hover:text-sky-600 flex items-center justify-center transition-all cursor-pointer border border-transparent hover:border-sky-100 dark:hover:border-slate-800"
                    title="Reset Zoom"
                >
                    <PhArrowCounterClockwise :size="14" weight="bold" />
                </button>
            </div>

            <div class="w-[1px] h-5 bg-slate-200 dark:bg-slate-800"></div>

            <button
                @click="toggleDetailFocus"
                class="w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer border border-transparent"
                :class="
                    isDetailZoomActive
                        ? 'bg-sky-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-slate-750'
                        : 'hover:bg-sky-50 dark:hover:bg-slate-850 text-slate-650 dark:text-slate-350 hover:text-sky-600 dark:hover:text-sky-400 hover:border-sky-100 dark:hover:border-slate-800'
                "
                :title="
                    isDetailZoomActive
                        ? 'Reset Tampilan'
                        : 'Fokus Detail Ke Objek'
                "
            >
                <PhMagnifyingGlass :size="14" weight="bold" />
            </button>
        </div>

        <!-- Mode Preview Berdampingan (Kedua Sisi) (Hanya tampil jika mode 'both') -->
        <div
            v-if="store.currentView === 'both'"
            class="w-full flex flex-col md:flex-row gap-8 justify-center items-center py-4 perspective-1000"
        >
            <!-- Kaos Depan (3D Entry Card) -->
            <div
                class="relative w-[320px] h-[320px] rounded-3xl flex items-center justify-center overflow-hidden border border-sky-100 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900/60 animate-preview-left transform-style-3d group/preview"
                :class="{
                    'bg-checkerboard-light':
                        store.backdropType === 'checkerboard',
                    'bg-studio-wall': store.backdropType === 'gradient',
                }"
                :style="containerBackdropStyle"
            >
                <!-- Wrapper Skala Ukuran Kaos -->
                <div
                    class="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none"
                    :style="{ transform: `scale(${shirtScale})` }"
                >
                    <!-- Wrapper untuk Floating Animation -->
                    <div
                        class="absolute inset-0 w-full h-full flex items-center justify-center preview-card-front pointer-events-none"
                    >
                        <!-- Lapisan Kaos Mockup -->
                        <img
                            v-if="frontMockupUrl"
                            :src="frontMockupUrl"
                            class="absolute inset-0 w-full h-full object-contain filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.15)] group-hover/preview:scale-[1.03] transition-transform duration-500"
                            alt="Mockup Depan"
                        />
                        <!-- Area Desain Sablon -->
                        <div
                            class="absolute"
                            :style="getPrintableAreaStyle('front', 320)"
                        >
                            <img
                                v-if="store.frontDesignUrl"
                                :src="store.frontDesignUrl"
                                class="w-full h-full object-contain"
                            />
                        </div>
                    </div>
                </div>
                <!-- Efek gloss kilau saat di-hover -->
                <div
                    class="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 transform translate-x-[-100%] group-hover/preview:translate-x-[100%] transition-transform duration-1000 ease-out pointer-events-none"
                ></div>
                <span
                    class="absolute bottom-3 z-10 text-[9px] bg-sky-600/90 text-white font-extrabold px-3.5 py-1 rounded-full uppercase tracking-widest shadow-md border border-sky-400/20 backdrop-blur-sm"
                    >Tampak Depan</span
                >
            </div>

            <!-- Kaos Belakang (3D Entry Card) -->
            <div
                class="relative w-[320px] h-[320px] rounded-3xl flex items-center justify-center overflow-hidden border border-sky-100 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900/60 animate-preview-right transform-style-3d group/preview"
                :class="{
                    'bg-checkerboard-light':
                        store.backdropType === 'checkerboard',
                    'bg-studio-wall': store.backdropType === 'gradient',
                }"
                :style="containerBackdropStyle"
            >
                <!-- Wrapper Skala Ukuran Kaos -->
                <div
                    class="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none"
                    :style="{ transform: `scale(${shirtScale})` }"
                >
                    <!-- Wrapper untuk Floating Animation -->
                    <div
                        class="absolute inset-0 w-full h-full flex items-center justify-center preview-card-back pointer-events-none"
                    >
                        <!-- Lapisan Kaos Mockup -->
                        <img
                            v-if="backMockupUrl"
                            :src="backMockupUrl"
                            class="absolute inset-0 w-full h-full object-contain filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.15)] group-hover/preview:scale-[1.03] transition-transform duration-500"
                            alt="Mockup Belakang"
                        />
                        <!-- Area Desain Sablon -->
                        <div
                            class="absolute"
                            :style="getPrintableAreaStyle('back', 320)"
                        >
                            <img
                                v-if="store.backDesignUrl"
                                :src="store.backDesignUrl"
                                class="w-full h-full object-contain"
                            />
                        </div>
                    </div>
                </div>
                <!-- Efek gloss kilau saat di-hover -->
                <div
                    class="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 transform translate-x-[-100%] group-hover/preview:translate-x-[100%] transition-transform duration-1000 ease-out pointer-events-none"
                ></div>
                <span
                    class="absolute bottom-3 z-10 text-[9px] bg-sky-600/90 text-white font-extrabold px-3.5 py-1 rounded-full uppercase tracking-widest shadow-md border border-sky-400/20 backdrop-blur-sm"
                    >Tampak Belakang</span
                >
            </div>
        </div>

        <!-- Dimensi Fisik Sablon Terpilih (cm) secara Real-Time -->
        <Transition name="fade">
            <div
                v-if="store.currentView !== 'both' && selectedObjectDimensions"
                class="mt-5 w-[500px] p-3.5 bg-gradient-to-r from-sky-500/10 to-indigo-500/10 dark:from-slate-800/30 dark:to-slate-850/30 border border-sky-200/50 dark:border-slate-800/80 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200"
            >
                <div class="flex items-center gap-2">
                    <div
                        class="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-sm"
                    >
                        <PhRuler :size="16" weight="bold" />
                    </div>
                    <div class="text-left">
                        <h5
                            class="text-[9px] font-black uppercase tracking-wider text-sky-900 dark:text-sky-300"
                        >
                            Dimensi Fisik Sablon (Toleransi 1-2 Cm)
                        </h5>
                        <p
                            class="text-[8px] text-slate-500 dark:text-slate-400 font-medium mt-0.5"
                        >
                            Dihitung otomatis untuk kaos ukuran
                            <strong
                                class="text-slate-700 dark:text-slate-350 font-extrabold"
                                >{{ store.currentSize }}</strong
                            >
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <!-- Input Lebar (W) -->
                    <div
                        class="flex items-center gap-1 bg-white dark:bg-slate-850 border border-sky-100 dark:border-slate-800 px-2 py-1 rounded-xl shadow-sm"
                    >
                        <span
                            class="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase"
                            >L:</span
                        >
                        <input
                            type="number"
                            step="0.1"
                            min="1"
                            max="100"
                            :value="selectedObjectDimensions.width"
                            @input="handleWidthInput"
                            class="w-12 px-0.5 text-xs font-extrabold font-mono text-center text-sky-600 dark:text-sky-400 bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            title="Lebar sablon dalam cm (ketik untuk mengubah)"
                        />
                        <span class="text-[8px] font-bold text-slate-400"
                            >cm</span
                        >
                    </div>

                    <span
                        class="text-slate-400 dark:text-slate-500 font-bold text-xs"
                        >×</span
                    >

                    <!-- Input Tinggi (H) -->
                    <div
                        class="flex items-center gap-1 bg-white dark:bg-slate-850 border border-sky-100 dark:border-slate-800 px-2 py-1 rounded-xl shadow-sm"
                    >
                        <span
                            class="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase"
                            >T:</span
                        >
                        <input
                            type="number"
                            step="0.1"
                            min="1"
                            max="100"
                            :value="selectedObjectDimensions.height"
                            @input="handleHeightInput"
                            class="w-12 px-0.5 text-xs font-extrabold font-mono text-center text-sky-600 dark:text-sky-400 bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            title="Tinggi sablon dalam cm (ketik untuk mengubah)"
                        />
                        <span class="text-[8px] font-bold text-slate-400"
                            >cm</span
                        >
                    </div>
                </div>
            </div>
        </Transition>

        <!-- Petunjuk Singkat (Hanya Tampil saat Mode Edit) -->
        <div
            v-if="store.currentView !== 'both'"
            class="mt-5 flex items-center justify-center gap-6 text-xs text-slate-650 dark:text-slate-400"
        >
            <span
                class="flex items-center gap-1.5 bg-white/80 dark:bg-slate-850/80 border border-sky-100 dark:border-slate-800 px-2.5 py-1 rounded-lg shadow-sm"
            >
                <PhCursorClick
                    class="text-sky-600 dark:text-sky-400"
                    :size="14"
                    weight="bold"
                />
                Klik ganda teks untuk mengubah isi
            </span>
        </div>
    </div>
</template>

<style scoped>
/* Menghilangkan border outline pada canvas Fabric */
.canvas-container {
    outline: none !important;
}

/* Pola catur transparan ramah tema terang untuk backdrop (Photoshop style) */
.bg-checkerboard-light {
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
    background-color: #ffffff;
}

/* Latar belakang dinding studio semen bersih (radial vignette) */
.bg-studio-wall {
    background: radial-gradient(circle, #f8fafc 0%, #cbd5e1 100%);
}

/* Kelas Perspektif 3D pada container */
.perspective-1000 {
    perspective: 1000px;
}

/* Mempertahankan ruang 3D untuk child element */
.transform-style-3d {
    transform-style: preserve-3d;
}

/* Menyembunyikan sisi belakang elemen saat berputar */
.backface-hidden {
    backface-visibility: hidden;
}

/* Keyframes untuk Animasi Putar 3D (Horizontal Flip 90 derajat dan kembali) */
@keyframes flip-half {
    0% {
        transform: rotateY(0deg) scale(1);
        filter: brightness(1);
    }
    50% {
        transform: rotateY(90deg) scale(0.92);
        filter: brightness(
            0.85
        ); /* Beri sedikit bayangan redup di titik tengah putaran */
    }
    100% {
        transform: rotateY(0deg) scale(1);
        filter: brightness(1);
    }
}

.animate-flip-3d {
    animation: flip-half 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

/* Keyframes untuk Masuk 3D Kaos Depan */
@keyframes entry-left {
    0% {
        opacity: 0;
        transform: translateY(30px) scale(0.9) rotateY(-20deg);
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
        transform: translateY(30px) scale(0.9) rotateY(20deg);
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
        transform: translateY(-8px);
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
        transform: translateY(-10px);
    }
    100% {
        transform: translateY(0px);
    }
}

/* Terapkan kelas animasi masuk */
.animate-preview-left {
    animation: entry-left 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.animate-preview-right {
    animation: entry-right 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards; /* Delay agar asinkron mewah */
}

/* Terapkan kelas melayang berkelanjutan */
.preview-card-front {
    animation: float-front 4.5s ease-in-out infinite;
}

.preview-card-back {
    animation: float-back 5s ease-in-out infinite;
}
</style>
