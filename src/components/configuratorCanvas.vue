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
            return '50% 50%'; // Kembali ke tengah jika kursor berada di luar area
        }
    }

    // Dimensi container visual workspace saat ini
    const canvasWidth = 550;
    const canvasHeight = 550;
    
    // Konfigurasi area cetak aktif
    const config = currentCanvasConfig.value;
    
    if (fabricCanvas) {
        const activeObj = fabricCanvas.getActiveObject();
        if (activeObj) {
            // Dapatkan pusat absolut objek relatif terhadap canvas pembungkus 550x550px
            const printAreaX = (config.left / 500) * canvasWidth;
            const printAreaY = (config.top / 500) * canvasHeight;
            const printAreaW = (config.width / 500) * canvasWidth;
            const printAreaH = (config.height / 500) * canvasHeight;
            
            const objCenter = activeObj.getCenterPoint();
            const objXInCanvas = printAreaX + (objCenter.x / fabricCanvas.width) * printAreaW;
            const objYInCanvas = printAreaY + (objCenter.y / fabricCanvas.height) * printAreaH;
            
            // Ubah koordinat absolut menjadi persentase transform-origin
            const pctX = (objXInCanvas / canvasWidth) * 100;
            const pctY = (objYInCanvas / canvasHeight) * 100;
            
            return `${pctX.toFixed(2)}% ${pctY.toFixed(2)}%`;
        }
    }
    
    // Default: Pusat area cetak sablon (dada kaos)
    const centerX = ((config.left + config.width / 2) / 500) * 100;
    const centerY = ((config.top + config.height / 2) / 500) * 100;
    return `${centerX.toFixed(2)}% ${centerY.toFixed(2)}%`;
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

// Hitung dimensi riil area sablon depan/belakang saat ini berdasarkan ukuran kaos aktif
const printableAreaDimensions = computed(() => {
    const sizeData = store.shirtSizes[store.currentSize];
    const maxPrintW = sizeData.width * 0.52; // 52% lebar dada kaos
    const maxPrintH = sizeData.length * 0.5; // 50% panjang kaos
    return {
        width: parseFloat(maxPrintW.toFixed(1)),
        height: parseFloat(maxPrintH.toFixed(1)),
    };
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

    // Tentukan viewKey aktif saat ini
    const viewKey = (
        displayedView.value === "both" ? "front" : displayedView.value
    ) as CanvasViewType;
    const canvasConfig = canvasConfigs[viewKey];

    // Ambil data centimeter dada kaos aktif
    const sizeData = store.shirtSizes[store.currentSize];

    // Model matematika: batas sablon fisik proporsional terhadap ukuran kaos
    const maxPrintW = sizeData.width * 0.52; // area cetak mengambil 52% lebar dada kaos
    const maxPrintH = sizeData.length * 0.5; // area cetak mengambil 50% panjang kaos

    // Hitung proporsi objek terhadap area cetak di kanvas Fabric
    const propW = objW / canvasConfig.width;
    const propH = objH / canvasConfig.height;

    // Hitung ukuran fisik riil dalam cm
    const realW = propW * maxPrintW;
    const realH = propH * maxPrintH;

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

// Menyimpan referensi mockup hasil pre-proses
let processedFront: HTMLCanvasElement | null = null;
let processedBack: HTMLCanvasElement | null = null;

// Konfigurasi letak dan ukuran area sablon (chest area) pada canvas mockup 500x500px
const canvasConfigs = {
    front: {
        width: 200,
        height: 270,
        top: 110,
        left: 150,
    },
    back: {
        width: 210,
        height: 290,
        top: 100,
        left: 145,
    },
};

// Menghitung warna mockup secara statis untuk tampak depan dan belakang
const frontMockupUrl = computed(() => {
    if (processedFront) {
        return colorizeMockup(processedFront, store.shirtColor);
    }
    return tshirtFrontImg;
});

const backMockupUrl = computed(() => {
    if (processedBack) {
        return colorizeMockup(processedBack, store.shirtColor);
    }
    return tshirtBackImg;
});

// Fungsi helper untuk menghitung area cetak dengan ukuran fleksibel (untuk mode preview 320px)
const getPrintableAreaStyle = (view: "front" | "back", size: number) => {
    const config = canvasConfigs[view];
    return {
        top: `${(config.top / 500) * size}px`,
        left: `${(config.left / 500) * size}px`,
        width: `${(config.width / 500) * size}px`,
        height: `${(config.height / 500) * size}px`,
    };
};

// Computed property untuk konfigurasi kanvas aktif saat ini (aman dari error tipe both)
const currentCanvasConfig = computed(() => {
    const viewKey = (
        displayedView.value === "both" ? "front" : displayedView.value
    ) as CanvasViewType;
    return canvasConfigs[viewKey];
});

// Menghitung gaya letak area sablon di UI secara absolute
const printableAreaStyle = computed(() => {
    const config = currentCanvasConfig.value;
    return {
        top: `${(config.top / 500) * 100}%`,
        left: `${(config.left / 500) * 100}%`,
        width: `${(config.width / 500) * 100}%`,
        height: `${(config.height / 500) * 100}%`,
    };
});

// Melakukan pre-proses gambar kaos untuk memuat gambar transparan ke canvas
const initMockupImages = async () => {
    try {
        isProcessing.value = true;
        processedFront = await processMockupImage(tshirtFrontImg);
        processedBack = await processMockupImage(tshirtBackImg);
        updateMockupColor();
    } catch (error) {
        console.error("Gagal memproses gambar mockup:", error);
    } finally {
        isProcessing.value = false;
    }
};

// Memperbarui warna kaos secara dinamis berdasarkan state store
const updateMockupColor = () => {
    if (displayedView.value === "front" && processedFront) {
        currentMockupUrl.value = colorizeMockup(
            processedFront,
            store.shirtColor,
        );
    } else if (displayedView.value === "back" && processedBack) {
        currentMockupUrl.value = colorizeMockup(
            processedBack,
            store.shirtColor,
        );
    }
};

// Menginisialisasi Fabric.js Canvas
const initFabricCanvas = () => {
    if (!canvasRef.value) return;

    const config = currentCanvasConfig.value;
    fabricCanvas = new Canvas(canvasRef.value, {
        width: config.width,
        height: config.height,
        preserveObjectStacking: true,
        backgroundColor: "transparent",
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
    });

    // Sinkronisasi posisi tooltip melayang saat objek dimanipulasi secara real-time
    fabricCanvas.on("object:moving", updateTooltipPosition);
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
    });
    fabricCanvas.on("object:removed", updateDesignPreviews);
};

// Menyimpan state kanvas saat ini ke Pinia
const saveCurrentState = () => {
    if (fabricCanvas && displayedView.value !== "both") {
        store.saveCanvasState(displayedView.value, fabricCanvas.toJSON());
        store.saveToLocalStorage(); // Simpan perubahan ke LocalStorage
    }
};

// Memuat state kanvas untuk view tertentu dari Pinia
const loadStateForView = async (view: "front" | "back") => {
    if (!fabricCanvas) return;

    // Hapus semua objek
    fabricCanvas.clear();

    const savedState = store.canvasStates[view];
    if (savedState) {
        try {
            await fabricCanvas.loadFromJSON(savedState);
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
    const config = canvasConfigs[view];
    fabricCanvas.setDimensions({
        width: config.width,
        height: config.height,
    });
    fabricCanvas.renderAll();
};

// Watcher untuk mendeteksi perubahan sisi kaos dengan efek flip 3D
watch(
    () => store.currentView,
    async (newView, oldView) => {
        // Simpan state kanvas untuk view lama (oldView) sebelum diubah
        if (oldView && oldView !== "both") {
            if (fabricCanvas) {
                store.saveCanvasState(oldView, fabricCanvas.toJSON());
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

// Watcher untuk mendeteksi perubahan ukuran kaos agar mengupdate dimensi fisik sablon
watch(
    () => store.currentSize,
    () => {
        updateSelectedObjectDimensions();
        nextTick(() => {
            updateTooltipPosition();
        });
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
    const config = currentCanvasConfig.value;

    const text = new IText(textVal, {
        left: config.width / 2 - 50,
        top: config.height / 2 - 20,
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
    const config = currentCanvasConfig.value;

    const loadAndAddToCanvas = (url: string) => {
        const imgEl = new Image();
        imgEl.onload = () => {
            const fabricImg = new FabricImage(imgEl, {
                left: config.width / 2 - 60,
                top: config.height / 2 - 60,
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

// Fungsi pembantu untuk memproduksi data URL cetak transparan secara dinamis untuk view tertentu
const getPrintDataUrl = async (view: "front" | "back"): Promise<string> => {
    if (displayedView.value === view && fabricCanvas) {
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
        return fabricCanvas.toDataURL({
            format: "png",
            multiplier: 4,
        });
    }

    const savedState = store.canvasStates[view];
    if (!savedState) return "";

    return new Promise((resolve) => {
        const tempCanvasEl = document.createElement("canvas");
        const config = canvasConfigs[view];
        tempCanvasEl.width = config.width;
        tempCanvasEl.height = config.height;

        const tempCanvas = new Canvas(tempCanvasEl, {
            width: config.width,
            height: config.height,
            backgroundColor: "transparent",
        });

        tempCanvas
            .loadFromJSON(savedState)
            .then(() => {
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

// Ekspor File Cetak Sablon Saja (Transparan)
const exportPrint = async (
    view: "front" | "back" | "both",
): Promise<{ name: string; dataUrl: string }[]> => {
    saveCurrentState();
    const results: { name: string; dataUrl: string }[] = [];

    if (view === "front" || view === "both") {
        const dataUrl = await getPrintDataUrl("front");
        if (dataUrl) {
            results.push({
                name: `desain-sablon-depan-${Date.now()}.png`,
                dataUrl,
            });
        }
    }

    if (view === "back" || view === "both") {
        const dataUrl = await getPrintDataUrl("back");
        if (dataUrl) {
            results.push({
                name: `desain-sablon-belakang-${Date.now()}.png`,
                dataUrl,
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
            const exportCanvas = document.createElement("canvas");
            exportCanvas.width = img.width;
            exportCanvas.height = img.height;
            const ctx = exportCanvas.getContext("2d");
            if (!ctx) {
                resolve("");
                return;
            }

            // Gambar warna/tipe latar belakang terpilih
            await drawBackdrop(ctx, img.width, img.height);

            // Gambar warna kaos di atas backdrop
            ctx.drawImage(img, 0, 0);

            const mimeType =
                store.backdropType === "checkerboard"
                    ? "image/png"
                    : "image/jpeg";
            const quality =
                store.backdropType === "checkerboard" ? undefined : 0.95;

            if (printDataUrl) {
                const canvasImg = new Image();
                canvasImg.onload = () => {
                    const config = canvasConfigs[view];
                    const scaleX = img.width / 500;
                    const scaleY = img.height / 500;

                    ctx.drawImage(
                        canvasImg,
                        config.left * scaleX,
                        config.top * scaleY,
                        config.width * scaleX,
                        config.height * scaleY,
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

    if (view === "front" || view === "both") {
        const dataUrl = await getMockupDataUrl("front");
        if (dataUrl) {
            results.push({
                name: `mockup-kaos-depan-${Date.now()}.${ext}`,
                dataUrl,
            });
        }
    }

    if (view === "back" || view === "both") {
        const dataUrl = await getMockupDataUrl("back");
        if (dataUrl) {
            results.push({
                name: `mockup-kaos-belakang-${Date.now()}.${ext}`,
                dataUrl,
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
    deselectObject,
});
</script>

<template>
    <div class="flex flex-col items-center justify-center p-2 w-full">
        <!-- Container Mockup Kaos (Mode Edit - Hanya tampil jika bukan mode 'both') -->
        <div
            v-show="store.currentView !== 'both'"
            class="relative w-[550px] h-[550px] rounded-3xl flex items-center justify-center overflow-hidden border border-sky-100 dark:border-slate-800 transition-all duration-300 shadow-lg bg-white dark:bg-slate-900/60 perspective-1000"
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
                        transform: `scale(${shirtScale * zoomScale})`,
                        transformOrigin: transformOriginStyle,
                        transition: isDetailZoomActive ? 'transform 0.3s ease-out, transform-origin 0.15s ease-out' : ''
                    }"
                >
                    <!-- Lapisan Kaos Mockup (Dengan filter drop-shadow agar kaos terlihat timbul 3D) -->
                    <img
                        v-if="currentMockupUrl"
                        :src="currentMockupUrl"
                        class="absolute inset-0 w-full h-full object-contain pointer-events-none select-none filter drop-shadow-[0_25px_35px_rgba(0,0,0,0.18)] backface-hidden"
                        alt="Mockup Kaos"
                    />

                    <!-- Area Bounding Box / Sablon (Konsisten dengan tema Sky Blue) -->
                    <div
                        class="absolute border border-dashed border-sky-400/30 rounded-xl flex items-center justify-center bg-white/[0.01] hover:border-sky-500/60 hover:bg-sky-500/[0.02] transition-all duration-300 group/area backface-hidden pointer-events-auto"
                        :class="{
                            'border-sky-500/65 bg-sky-500/[0.01] shadow-[0_0_20px_rgba(14,165,233,0.1)]':
                                selectedObject,
                        }"
                        :style="printableAreaStyle"
                    >
                        <canvas ref="canvasRef"></canvas>

                        <!-- CAD Style Ruler / Garis Dimensi Area Sablon (Horizontal Atas) -->
                        <div
                            class="absolute bottom-full left-0 right-0 mb-1.5 flex flex-col items-center justify-end pointer-events-none opacity-25 group-hover/area:opacity-100 group-[.border-sky-500\/65]/area:opacity-100 transition-all duration-300"
                        >
                            <div
                                class="w-full flex items-center justify-between relative px-1"
                            >
                                <span
                                    class="w-1.5 h-1.5 border-b border-l border-sky-500 transform rotate-45"
                                ></span>
                                <div
                                    class="flex-grow h-[1px] bg-gradient-to-r from-sky-500/20 via-sky-500 to-sky-500/20"
                                ></div>
                                <span
                                    class="w-1.5 h-1.5 border-t border-r border-sky-500 transform rotate-45"
                                ></span>
                                <span
                                    class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-sky-950/85 backdrop-blur-sm text-[8px] font-black font-mono text-sky-200 px-2 py-0.5 rounded-full border border-sky-400/20 shadow-sm"
                                >
                                    {{ printableAreaDimensions.width }} cm
                                </span>
                            </div>
                        </div>

                        <!-- CAD Style Ruler / Garis Dimensi Area Sablon (Vertikal Kiri) -->
                        <div
                            class="absolute right-full top-0 bottom-0 mr-1.5 flex items-center justify-end pointer-events-none opacity-25 group-hover/area:opacity-100 group-[.border-sky-500\/65]/area:opacity-100 transition-all duration-300"
                        >
                            <div
                                class="h-full flex flex-col items-center justify-between relative py-1"
                            >
                                <span
                                    class="w-1.5 h-1.5 border-t border-l border-sky-500 transform rotate-45"
                                ></span>
                                <div
                                    class="flex-grow w-[1px] bg-gradient-to-b from-sky-500/20 via-sky-500 to-sky-500/20"
                                ></div>
                                <span
                                    class="w-1.5 h-1.5 border-b border-r border-sky-500 transform rotate-45"
                                ></span>
                                <span
                                    class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-sky-950/85 backdrop-blur-sm text-[8px] font-black font-mono text-sky-200 px-2 py-0.5 rounded-full border border-sky-400/20 shadow-sm whitespace-nowrap transform -rotate-90"
                                >
                                    {{ printableAreaDimensions.height }} cm
                                </span>
                            </div>
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

                        <!-- Label Area Cetak (Muncul saat tidak ada objek yang dipilih) -->
                        <span
                            v-if="!selectedObject"
                            class="absolute bottom-2 text-[8px] bg-white dark:bg-slate-850 text-sky-850 dark:text-sky-200 border border-sky-200 dark:border-slate-800 px-2 py-0.5 backdrop-blur-sm rounded-md pointer-events-none tracking-widest uppercase font-black shadow-sm"
                        >
                            Area Sablon
                        </span>
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

            <!-- Kontrol Zoom Melayang (Glassmorphism Premium di Pojok Kiri Bawah) -->
            <div
                v-if="store.currentView !== 'both'"
                class="absolute bottom-4 left-4 z-35 bg-white/90 dark:bg-slate-900/90 border border-sky-100 dark:border-slate-800 p-1.5 rounded-xl shadow-md flex items-center gap-1 backdrop-blur-md pointer-events-auto"
            >
                <button
                    @click="zoomOut"
                    class="w-7 h-7 rounded-lg hover:bg-sky-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-all cursor-pointer"
                    title="Zoom Out"
                >
                    <PhMinus :size="12" weight="bold" />
                </button>
                <span
                    class="text-[9px] font-black font-mono text-slate-700 dark:text-slate-200 min-w-[36px] text-center"
                >
                    {{ Math.round(zoomScale * 100) }}%
                </span>
                <button
                    @click="zoomIn"
                    class="w-7 h-7 rounded-lg hover:bg-sky-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-all cursor-pointer"
                    title="Zoom In"
                >
                    <PhPlus :size="12" weight="bold" />
                </button>
                <div class="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 mx-0.5"></div>
                <button
                    @click="toggleDetailFocus"
                    class="px-2 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                    :class="isDetailZoomActive ? 'bg-sky-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400 font-semibold' : 'hover:bg-sky-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 hover:text-sky-600 dark:hover:text-sky-400'"
                    :title="isDetailZoomActive ? 'Reset Tampilan' : 'Fokus Detail Ke Objek'"
                >
                    <PhMagnifyingGlass :size="12" weight="bold" />
                    <span class="text-[8px] font-black uppercase tracking-wider">Detail</span>
                </button>
                <div class="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 mx-0.5"></div>
                <button
                    @click="resetZoom"
                    class="w-7 h-7 rounded-lg hover:bg-sky-50 dark:hover:bg-slate-800 text-slate-500 hover:text-sky-655 flex items-center justify-center transition-all cursor-pointer"
                    title="Reset Zoom"
                >
                    <PhArrowCounterClockwise :size="12" weight="bold" />
                </button>
            </div>
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
                class="mt-5 w-[550px] p-3.5 bg-gradient-to-r from-sky-500/10 to-indigo-500/10 dark:from-slate-800/30 dark:to-slate-850/30 border border-sky-200/50 dark:border-slate-800/80 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200"
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
                            Dimensi Fisik Sablon (Riil)
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
                <div class="text-right">
                    <span
                        class="text-sm font-extrabold font-mono text-sky-600 dark:text-sky-400 bg-white dark:bg-slate-850 border border-sky-100 dark:border-slate-800 px-3 py-1 rounded-xl shadow-sm"
                    >
                        {{ selectedObjectDimensions.width }}
                        <span
                            class="text-[10px] font-bold text-slate-400 dark:text-slate-500"
                            >cm</span
                        >
                        <span
                            class="text-slate-300 dark:text-slate-600 font-light mx-1"
                            >×</span
                        >
                        {{ selectedObjectDimensions.height }}
                        <span
                            class="text-[10px] font-bold text-slate-400 dark:text-slate-500"
                            >cm</span
                        >
                    </span>
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
                <span
                    class="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block animate-pulse"
                ></span>
                Area Sablon Dibatasi
            </span>
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

        <!-- Tabel Panduan Ukuran Kaos Interaktif (Selalu Tampil untuk Ditonton/Dilihat) -->
        <div
            class="mt-5 w-[550px] bg-white/70 dark:bg-slate-900/60 border border-sky-100/50 dark:border-slate-800/80 backdrop-blur-md rounded-2xl p-4.5 shadow-sm space-y-3 text-slate-850 dark:text-slate-200"
        >
            <div class="flex items-center justify-between">
                <h4
                    class="text-[10px] font-black uppercase tracking-wider text-sky-850 dark:text-sky-300 flex items-center gap-1.5"
                >
                    <span
                        class="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"
                    ></span>
                    Tabel Panduan Ukuran Kaos (cm)
                </h4>
                <span
                    class="text-[9px] text-slate-500 dark:text-slate-400 font-bold bg-sky-50 dark:bg-slate-850 border border-sky-100 dark:border-slate-750 px-2.5 py-0.5 rounded-lg"
                >
                    Ukuran Aktif:
                    <strong class="text-sky-600 dark:text-sky-400 font-black">{{
                        store.currentSize
                    }}</strong>
                </span>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-center text-[10px] border-collapse">
                    <thead>
                        <tr
                            class="border-b border-sky-100/30 dark:border-slate-800 text-slate-400 dark:text-slate-500"
                        >
                            <th
                                class="py-2 px-1 text-left font-bold uppercase tracking-wider"
                            >
                                Ukuran
                            </th>
                            <th
                                v-for="size in [
                                    'S',
                                    'M',
                                    'L',
                                    'XL',
                                    'XXL',
                                    'XXXL',
                                ]"
                                :key="size"
                                :class="[
                                    'py-2 px-1 font-black transition-all duration-300',
                                    store.currentSize === size
                                        ? 'text-sky-600 dark:text-sky-400 text-xs scale-110'
                                        : '',
                                ]"
                            >
                                {{ size }}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            class="border-b border-sky-100/10 dark:border-slate-850/40 text-slate-700 dark:text-slate-350"
                        >
                            <td
                                class="py-2.5 px-1 text-left font-bold text-slate-500 dark:text-slate-400"
                            >
                                Panjang
                            </td>
                            <td
                                v-for="size in [
                                    'S',
                                    'M',
                                    'L',
                                    'XL',
                                    'XXL',
                                    'XXXL',
                                ]"
                                :key="size"
                                :class="[
                                    'py-2.5 px-1 transition-all duration-300',
                                    store.currentSize === size
                                        ? 'bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-extrabold rounded-lg'
                                        : '',
                                ]"
                            >
                                {{
                                    store.shirtSizes[
                                        size as keyof typeof store.shirtSizes
                                    ].length
                                }}
                            </td>
                        </tr>
                        <tr class="text-slate-700 dark:text-slate-350">
                            <td
                                class="py-2.5 px-1 text-left font-bold text-slate-500 dark:text-slate-400"
                            >
                                Lebar
                            </td>
                            <td
                                v-for="size in [
                                    'S',
                                    'M',
                                    'L',
                                    'XL',
                                    'XXL',
                                    'XXXL',
                                ]"
                                :key="size"
                                :class="[
                                    'py-2.5 px-1 transition-all duration-300',
                                    store.currentSize === size
                                        ? 'bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-extrabold rounded-lg'
                                        : '',
                                ]"
                            >
                                {{
                                    store.shirtSizes[
                                        size as keyof typeof store.shirtSizes
                                    ].width
                                }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
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
