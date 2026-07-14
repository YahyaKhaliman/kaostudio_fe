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

const initCropper = () => {
    if (!imageRef.value) return;

    // Hancurkan cropper lama jika ada
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }

    cropper = new Cropper(imageRef.value, {
        aspectRatio: NaN, // Bebas memotong ukuran apa saja (free crop)
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
const rotateRight = () => cropper?.rotate(90);
const rotateLeft = () => cropper?.rotate(-90);
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

const reset = () => {
    if (!cropper) return;
    cropper.reset();
    isFlipH.value = false;
    isFlipV.value = false;
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
            class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
            @click.self="emit('close')"
        >
            <!-- Panel Dialog Modal -->
            <div
                class="bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
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
                            Potong Gambar (Crop)
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

                <!-- Area Preview Gambar & Cropper -->
                <div class="flex-grow p-6 overflow-hidden flex items-center justify-center bg-slate-950 dark:bg-slate-955 min-h-[300px] max-h-[50vh] relative">
                    <div class="w-full h-full max-h-[40vh] flex items-center justify-center">
                        <img
                            ref="imageRef"
                            :src="imageUrl"
                            class="max-w-full max-h-full opacity-0"
                            style="display: block; max-width: 100%;"
                        />
                    </div>
                </div>

                <!-- Bilah Alat Kontrol (Cropper Toolbar) -->
                <div
                    class="p-3 border-t border-sky-100/50 dark:border-slate-800/60 flex flex-wrap items-center justify-center gap-1.5 bg-slate-50/30 dark:bg-slate-955/20"
                >
                    <button
                        @click="rotateLeft"
                        class="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-sky-100/80 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-slate-850 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-all cursor-pointer"
                        title="Putar Kiri (-90°)"
                        type="button"
                    >
                        <PhArrowCounterClockwise :size="14" weight="bold" />
                    </button>
                    <button
                        @click="rotateRight"
                        class="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-sky-100/80 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-slate-850 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-all cursor-pointer"
                        title="Putar Kanan (90°)"
                        type="button"
                    >
                        <PhArrowClockwise :size="14" weight="bold" />
                    </button>

                    <div class="w-[1px] h-5 bg-slate-200 dark:bg-slate-800 mx-1"></div>

                    <button
                        @click="zoomIn"
                        class="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-sky-100/80 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-slate-850 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-all cursor-pointer"
                        title="Perbesar"
                        type="button"
                    >
                        <PhMagnifyingGlassPlus :size="14" weight="bold" />
                    </button>
                    <button
                        @click="zoomOut"
                        class="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-sky-100/80 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-slate-850 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-all cursor-pointer"
                        title="Perkecil"
                        type="button"
                    >
                        <PhMagnifyingGlassMinus :size="14" weight="bold" />
                    </button>

                    <div class="w-[1px] h-5 bg-slate-200 dark:bg-slate-800 mx-1"></div>

                    <button
                        @click="flipHorizontal"
                        class="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-sky-100/80 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-slate-850 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-all cursor-pointer"
                        :class="{ 'border-sky-500 bg-sky-50 dark:bg-sky-950/30 text-sky-600': isFlipH }"
                        title="Balik Horisontal"
                        type="button"
                    >
                        <PhFlipHorizontal :size="14" weight="bold" />
                    </button>
                    <button
                        @click="flipVertical"
                        class="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-sky-100/80 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-slate-850 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-all cursor-pointer"
                        :class="{ 'border-sky-500 bg-sky-50 dark:bg-sky-950/30 text-sky-600': isFlipV }"
                        title="Balik Vertikal"
                        type="button"
                    >
                        <PhFlipVertical :size="14" weight="bold" />
                    </button>

                    <div class="w-[1px] h-5 bg-slate-200 dark:bg-slate-800 mx-1"></div>

                    <button
                        @click="reset"
                        class="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-sky-100/80 dark:border-slate-800 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 flex items-center justify-center transition-all cursor-pointer"
                        title="Atur Ulang (Reset)"
                        type="button"
                    >
                        <PhReset :size="14" weight="bold" />
                    </button>
                </div>

                <!-- Footer Modal (Tombol Cancel / Apply) -->
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
