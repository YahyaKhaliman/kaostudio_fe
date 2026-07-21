<script setup lang="ts">
import { ref } from "vue";
import { useAuthStore } from "../stores/authStore";
import {
    PhX,
    PhLockKey,
    PhUser,
    PhSignIn,
    PhWarningCircle,
    PhSpinner,
} from "@phosphor-icons/vue";

const props = defineProps<{
    isOpen: boolean;
}>();

const emit = defineEmits<{
    (e: "close"): void;
    (e: "success"): void;
}>();

const authStore = useAuthStore();

const username = ref("");
const password = ref("");
const errorMessage = ref("");
const isLoading = ref(false);

const handleLogin = async () => {
    if (!username.value || !password.value) {
        errorMessage.value = "Username dan password wajib diisi.";
        return;
    }

    isLoading.value = true;
    errorMessage.value = "";

    try {
        await authStore.login({
            username: username.value,
            password: password.value,
        });
        username.value = "";
        password.value = "";
        emit("success");
        emit("close");
    } catch (err: any) {
        errorMessage.value =
            err.message || "Username atau password salah. Silakan coba lagi.";
    } finally {
        isLoading.value = false;
    }
};
</script>

<template>
    <div
        v-if="isOpen"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-955/75 backdrop-blur-md p-4 overflow-y-auto"
        @click.self="emit('close')"
    >
        <div
            class="bg-white/95 dark:bg-slate-900/95 rounded-3xl shadow-2xl border border-sky-100/80 dark:border-slate-800 w-full max-w-md overflow-hidden transition-all duration-300 animate-in zoom-in-95 flex flex-col"
        >
            <!-- HEADER MODAL -->
            <div
                class="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-sky-100/60 dark:border-slate-800 flex items-center justify-between"
            >
                <div class="flex items-center gap-3">
                    <div
                        class="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 dark:border-sky-400/20"
                    >
                        <PhLockKey :size="20" weight="bold" />
                    </div>
                    <div>
                        <h2
                            class="text-sm align-center font-black uppercase tracking-wider text-slate-800 dark:text-slate-100"
                        >
                            Login
                        </h2>
                    </div>
                </div>
                <button
                    @click="emit('close')"
                    class="w-8 h-8 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer"
                    type="button"
                >
                    <PhX :size="18" weight="bold" />
                </button>
            </div>

            <!-- FORM CONTAINER -->
            <form @submit.prevent="handleLogin" class="p-6 space-y-4">
                <!-- Error Alert -->
                <div
                    v-if="errorMessage"
                    class="p-3 bg-red-50/80 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-800/60 text-xs text-red-600 dark:text-red-400 flex items-center gap-2 animate-in fade-in"
                >
                    <PhWarningCircle :size="18" class="shrink-0" />
                    <span class="font-semibold">{{ errorMessage }}</span>
                </div>

                <!-- Username Input -->
                <div class="space-y-1">
                    <label
                        class="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5"
                    >
                        <PhUser
                            :size="14"
                            class="text-sky-600 dark:text-sky-400"
                        />
                        Username
                    </label>
                    <input
                        type="text"
                        v-model="username"
                        placeholder="Masukkan username..."
                        required
                        class="w-full px-3.5 py-2.5 text-xs font-semibold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500/30 transition-all"
                    />
                </div>

                <!-- Password Input -->
                <div class="space-y-1">
                    <label
                        class="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5"
                    >
                        <PhLockKey
                            :size="14"
                            class="text-sky-600 dark:text-sky-400"
                        />
                        Password
                    </label>
                    <input
                        type="password"
                        v-model="password"
                        placeholder="Masukkan password..."
                        required
                        class="w-full px-3.5 py-2.5 text-xs font-semibold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500/30 transition-all"
                    />
                </div>

                <!-- Hint Kredensial -->
                <div
                    class="text-[10px] text-slate-400 dark:text-slate-500 text-center font-medium pt-1"
                >
                    * Gunakan akun ritel KAOSAN terdaftar
                </div>

                <!-- FOOTER ACTIONS -->
                <div
                    class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800"
                >
                    <button
                        type="button"
                        @click="emit('close')"
                        class="px-4 py-2.5 rounded-xl bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-750 text-red-600 dark:text-white text-xs font-bold transition-all cursor-pointer"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        :disabled="isLoading"
                        class="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95 flex items-center gap-2 disabled:opacity-50"
                    >
                        <PhSpinner
                            v-if="isLoading"
                            :size="16"
                            class="animate-spin"
                        />
                        <PhSignIn v-else :size="16" />
                        Login
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>
