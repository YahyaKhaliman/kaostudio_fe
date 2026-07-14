<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from "vue";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";
import {
    PhCrop,
    PhArrowClockwise,
    PhArrowCounterClockwise,
    PhMagnifyingGlassPlus,
    PhMagnifyingGlassMinus,
    PhFlipHorizontal,
    PhFlipVertical,
    PhArrowCounterClockwise as PhReset,
    PhCheck,
    PhX,
    PhArrowsOutCardinal,
} from "@phosphor-icons/vue";

const props = defineProps<{
    show: boolean;
    imageUrl: string;
}>();

const emit = defineEmits<{
    (e: "close"): void;
    (e: "crop", croppedDataUrl: string): void;
}>();

const imageRef = ref<HTMLImageElement | null>(null);
let cropper: Cropper | null = null;
const isFlipH = ref(false);
const isFlipV = ref(false);
const rotateValue = ref(0); // Sudut rotasi halus (-180 sampai 180)
const currentAspectRatio = ref<number | null>(null); // null = Bebas (Free)
const dragMode = ref<'crop' | 'move'>('crop');

const initCropper = () => {
    if (!imageRef.value) return;

    // Hancurkan cropper lama jika ada
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }

    cropper = new Cropper(imageRef.value, {
        aspectRatio: currentAspectRatio.value === null ? NaN : currentAspectRatio.value,
        dragMode: dragMode.value,
        viewMode: 1, // Membatasi crop box di dalam area gambar
        autoCropArea: 0.8, // Ukuran awal kotak crop
        responsive: true,
        background: false, // Hilangkan checkerboard default cropper
        modal: true,
        guides: true,
        center: true,
        highlight: true,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: true,
    });
};

watch(
    () => props.show,
    (isOpen) => {
        if (isOpen) {
            isFlipH.value = false;
            isFlipV.value = false;
            rotateValue.value = 0;
            currentAspectRatio.value = null;
            dragMode.value = "crop";
            nextTick(() => {
                initCropper();
            });
        } else {
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
        }
    }
);

// Pemicu inisialisasi ulang jika url gambar berubah sewaktu modal terbuka
watch(
    () => props.imageUrl,
    () => {
        if (props.show) {
            rotateValue.value = 0;
            nextTick(() => {
                initCropper();
            });
        }
    }
);

onUnmounted(() => {
    if (cropper) {
        cropper.destroy();
    }
});

// Aksi kontrol Cropper
const rotateRight90 = () => {
    if (!cropper) return;
    let newAngle = (rotateValue.value + 90) % 360;
    if (newAngle > 180) newAngle -= 360;
    if (newAngle < -180) newAngle += 360;
    rotateValue.value = newAngle;
    cropper.rotateTo(rotateValue.value);
};

const rotateLeft90 = () => {
    if (!cropper) return;
    let newAngle = (rotateValue.value - 90) % 360;
    if (newAngle > 180) newAngle -= 360;
    if (newAngle < -180) newAngle += 360;
    rotateValue.value = newAngle;
    cropper.rotateTo(rotateValue.value);
};

const handleRotateInput = (val: number) => {
    if (!cropper) return;
    // Batasi input antara -180 dan 180
    let cleanVal = parseFloat(val as any);
    if (isNaN(cleanVal)) cleanVal = 0;
    if (cleanVal > 180) cleanVal = 180;
    if (cleanVal < -180) cleanVal = -180;
    rotateValue.value = cleanVal;
    cropper.rotateTo(rotateValue.value);
};

const zoomIn = () => cropper?.zoom(0.1);
const zoomOut = () => cropper?.zoom(-0.1);

const flipHorizontal = () => {
    if (!cropper) return;
    isFlipH.value = !isFlipH.value;
    cropper.scaleX(isFlipH.value ? -1 : 1);
};

const flipVertical = () => {
    if (!cropper) return;
    isFlipV.value = !isFlipV.value;
    cropper.scaleY(isFlipV.value ? -1 : 1);
};

const setAspectRatio = (ratio: number | null) => {
    if (!cropper) return;
    cropper.setAspectRatio(ratio === null ? NaN : ratio);
    currentAspectRatio.value = ratio;
};

const setDragMode = (mode: 'crop' | 'move') => {
    if (!cropper || dragMode.value === mode) return;
    cropper.setDragMode(mode);
    dragMode.value = mode;
};

const reset = () => {
    if (!cropper) return;
    cropper.reset();
    isFlipH.value = false;
    isFlipV.value = false;
    rotateValue.value = 0;
    setAspectRatio(null);
    cropper.setDragMode("crop");
    dragMode.value = "crop";
};

const applyCrop = () => {
    if (!cropper) return;

    // Ambil data kanvas terpotong dengan resolusi maksimal agar tetap tajam saat disablon
    const croppedCanvas = cropper.getCroppedCanvas({
        maxWidth: 2000,
        maxHeight: 2000,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
    });

    if (croppedCanvas) {
        const croppedDataUrl = croppedCanvas.toDataURL("image/png");
        emit("crop", croppedDataUrl);
    }
};
</script>

<template>
    <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
    >
        <div
            v-if="show"
            class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-955/80 backdrop-blur-md"
            @click.self="emit('close')"
        >
            <!-- Panel Dialog Modal (max-w-4xl untuk ruang kerja yang luas) -->
            <div
                class="bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
            >
                <!-- Header Modal -->
                <div
                    class="p-4 border-b border-sky-100/60 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/30"
                >
                    <div class="flex items-center gap-2">
                        <div class="p-1.5 bg-sky-500/15 text-sky-600 dark:text-sky-400 rounded-lg">
                            <PhCrop :size="16" weight="bold" />
                        </div>
                        <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                            Potong & Atur Gambar
                        </h3>
                    </div>
                    <button
                        @click="emit('close')"
                        class="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer"
                        type="button"
                    >
                        <PhX :size="14" weight="bold" />
                    </button>
                </div>

                <!-- Area Preview Gambar & Cropper (Fleksibel & mencegah terpotong) -->
                <div class="flex-grow flex-shrink min-h-0 h-[320px] md:h-[480px] p-4 md:p-6 overflow-hidden flex items-center justify-center bg-slate-950 dark:bg-slate-955 relative">
                    <img
                        ref="imageRef"
                        :src="imageUrl"
                        class="max-w-full max-h-full opacity-0"
                        style="display: block; max-width: 100%;"
                    />
                </div>

                <!-- Bilah Alat Kontrol (Cropper Toolbar) -->
                <div
                    class="p-3.5 border-t border-sky-100/50 dark:border-slate-800/60 flex flex-wrap items-center justify-center gap-3 bg-slate-50/30 dark:bg-slate-955/20"
                >
                    <!-- Pilihan Mode Drag (Geser Gambar vs Gambar Kotak Potongan) -->
                    <div class="flex items-center bg-white dark:bg-slate-900 rounded-xl border border-sky-100/60 dark:border-slate-800 p-0.5 shadow-sm">
                        <button
                            @click="setDragMode('crop')"
                            class="px-3 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer flex items-center gap-1"
                            :class="dragMode === 'crop' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-200'"
                            title="Mode Potong (Ubah ukuran kotak potongan)"
                            type="button"
                        >
                            <PhCrop :size="12" weight="bold" />
                            <span>Potong</span>
                        </button>
                        <button
                            @click="setDragMode('move')"
                            class="px-3 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer flex items-center gap-1"
                            :class="dragMode === 'move' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-200'"
                            title="Mode Geser (Geser atau perbesar gambar)"
                            type="button"
                        >
                            <PhArrowsOutCardinal :size="12" weight="bold" />
                            <span>Geser</span>
                        </button>
                    </div>

                    <div class="w-[1px] h-5 bg-slate-200 dark:bg-slate-800 mx-0.5 hidden lg:block"></div>

                    <!-- Aspek Rasio Potongan (Aspect Ratio Presets) -->
                    <div class="flex items-center bg-white dark:bg-slate-900 rounded-xl border border-sky-100/60 dark:border-slate-800 p-0.5 shadow-sm">
                        <span class="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-2">Rasio:</span>
                        <div class="flex gap-0.5">
                            <button
                                @click="setAspectRatio(null)"
                                class="px-2.5 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer"
                                :class="currentAspectRatio === null ? 'bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                                type="button"
                            >
                                Bebas
                            </button>
                            <button
                                @click="setAspectRatio(1)"
                                class="px-2.5 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer"
                                :class="currentAspectRatio === 1 ? 'bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                                type="button"
                            >
                                1:1
                            </button>
                            <button
                                @click="setAspectRatio(4 / 3)"
                                class="px-2.5 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer"
                                :class="currentAspectRatio === 4/3 ? 'bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                                type="button"
                            >
                                4:3
                            </button>
                            <button
                                @click="setAspectRatio(16 / 9)"
                                class="px-2.5 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer"
                                :class="currentAspectRatio === 16/9 ? 'bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                                type="button"
                            >
                                16:9
                            </button>
                        </div>
                    </div>

                    <div class="w-[1px] h-5 bg-slate-200 dark:bg-slate-800 mx-0.5"></div>

                    <!-- Tombol Putar 90 Derajat -->
                    <div class="flex gap-1">
                        <button
                            @click="rotateLeft90"
                            class="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-sky-100/80 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-slate-850 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                            title="Putar Kiri (-90°)"
                            type="button"
                        >
                            <PhArrowCounterClockwise :size="14" weight="bold" />
                        </button>
                        <button
                            @click="rotateRight90"
                            class="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-sky-100/80 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-slate-850 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                            title="Putar Kanan (90°)"
                            type="button"
                        >
                            <PhArrowClockwise :size="14" weight="bold" />
                        </button>
                    </div>

                    <div class="w-[1px] h-5 bg-slate-200 dark:bg-slate-800 mx-0.5"></div>

                    <!-- Input Rotasi Presisi Slider & Derajat -->
                    <div class="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-sky-100/60 dark:border-slate-800 shadow-sm">
                        <span class="text-[9px] uppercase font-black text-slate-455 dark:text-slate-500">Putar:</span>
                        <input
                            type="range"
                            v-model.number="rotateValue"
                            @input="handleRotateInput(rotateValue)"
                            min="-180"
                            max="180"
                            step="0.5"
                            class="w-16 md:w-24 accent-sky-600 cursor-pointer h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg"
                        />
                        <div class="flex items-center">
                            <input
                                type="number"
                                v-model.number="rotateValue"
                                @input="handleRotateInput(rotateValue)"
                                min="-180"
                                max="180"
                                step="0.5"
                                class="w-11 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center rounded-lg py-0.5 text-[9.5px] font-mono font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                            <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 ml-0.5">°</span>
                        </div>
                    </div>

                    <div class="w-[1px] h-5 bg-slate-200 dark:bg-slate-800 mx-0.5"></div>

                    <!-- Pembesaran Gambar (Zoom) -->
                    <div class="flex gap-1">
                        <button
                            @click="zoomIn"
                            class="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-sky-100/80 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-slate-850 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                            title="Perbesar"
                            type="button"
                        >
                            <PhMagnifyingGlassPlus :size="14" weight="bold" />
                        </button>
                        <button
                            @click="zoomOut"
                            class="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-sky-100/80 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-slate-850 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                            title="Perkecil"
                            type="button"
                        >
                            <PhMagnifyingGlassMinus :size="14" weight="bold" />
                        </button>
                    </div>

                    <div class="w-[1px] h-5 bg-slate-200 dark:bg-slate-800 mx-0.5"></div>

                    <!-- Pembalikan Cermin (Flip) -->
                    <div class="flex gap-1">
                        <button
                            @click="flipHorizontal"
                            class="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-sky-100/80 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-slate-850 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                            :class="{ 'border-sky-500 bg-sky-50 dark:bg-sky-950/30 text-sky-600': isFlipH }"
                            title="Balik Horisontal"
                            type="button"
                        >
                            <PhFlipHorizontal :size="14" weight="bold" />
                        </button>
                        <button
                            @click="flipVertical"
                            class="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-sky-100/80 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-slate-850 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                            :class="{ 'border-sky-500 bg-sky-50 dark:bg-sky-950/30 text-sky-600': isFlipV }"
                            title="Balik Vertikal"
                            type="button"
                        >
                            <PhFlipVertical :size="14" weight="bold" />
                        </button>
                    </div>

                    <div class="w-[1px] h-5 bg-slate-200 dark:bg-slate-800 mx-0.5"></div>

                    <button
                        @click="reset"
                        class="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-sky-100/80 dark:border-slate-800 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title="Atur Ulang (Reset)"
                        type="button"
                    >
                        <PhReset :size="14" weight="bold" />
                    </button>
                </div>

                <!-- Footer Modal (Tombol Batal / Terapkan) -->
                <div
                    class="p-4 border-t border-sky-100/60 dark:border-slate-800/80 flex justify-end gap-2 bg-slate-50/50 dark:bg-slate-950/30"
                >
                    <button
                        @click="emit('close')"
                        class="py-2 px-4 text-xs font-bold rounded-xl border border-sky-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                        type="button"
                    >
                        Batal
                    </button>
                    <button
                        @click="applyCrop"
                        class="py-2 px-4 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition-all flex items-center gap-1.5 border border-sky-500/10 shadow-sm cursor-pointer"
                        type="button"
                    >
                        <PhCheck :size="13" weight="bold" />
                        <span>Terapkan Potongan</span>
                    </button>
                </div>
            </div>
        </div>
    </Transition>
</template>

<style>
/* Kustomisasi gaya CSS CropperJS agar cocok dengan tema premium */
.cropper-view-box {
    outline: 2px solid #0ea5e9; /* Sky-500 outline untuk kotak crop */
    outline-color: rgba(14, 165, 233, 0.75);
}
.cropper-line {
    background-color: #0ea5e9;
}
.cropper-point {
    background-color: #ffffff;
    border: 2.5px solid #0284c7; /* Sky-600 outline untuk handle sudut */
    width: 10px;
    height: 10px;
}
.cropper-point.point-se {
    width: 12px;
    height: 12px;
    opacity: 1;
}
.cropper-point.point-se::before {
    background-color: #0ea5e9;
}
.cropper-bg {
    background-image: none; /* Hilangkan checkerboard cropper default */
    background-color: #020617; /* Slate-950 backdrop */
}
</style>
