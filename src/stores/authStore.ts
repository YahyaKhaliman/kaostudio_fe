import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { loginAdmin, type LoginPayload, type LoginResponse } from "../services/api";

export interface AuthUser {
    id: string | number;
    username: string;
    nama: string;
    role: "admin" | "designer" | "guest";
    token: string;
}

export const useAuthStore = defineStore("auth", () => {
    const user = ref<AuthUser | null>(null);
    const token = ref<string>(localStorage.getItem("kaostudio_token") || "");

    // Load initial user state from localStorage
    const savedUser = localStorage.getItem("kaostudio_user");
    if (savedUser) {
        try {
            user.value = JSON.parse(savedUser);
        } catch (e) {
            console.error("Gagal membaca user data dari localStorage:", e);
        }
    }

    const isLoggedIn = computed(() => {
        return !!token.value && user.value?.role !== "guest";
    });

    const isGuest = computed(() => {
        return !isLoggedIn.value;
    });

    const login = async (credentials: LoginPayload): Promise<AuthUser> => {
        try {
            const data = await loginAdmin(credentials);
            const authUserData: AuthUser = {
                id: data.user?.id || 1,
                username: data.user?.username || credentials.username,
                nama: data.user?.nama || "Admin Store",
                role: (data.user?.role as any) || "admin",
                token: data.token || "kaostudio-token-sample",
            };

            user.value = authUserData;
            token.value = authUserData.token;

            localStorage.setItem("kaostudio_token", authUserData.token);
            localStorage.setItem("kaostudio_user", JSON.stringify(authUserData));

            return authUserData;
        } catch (error) {
            console.error("Login gagal:", error);
            throw error;
        }
    };

    const logout = () => {
        user.value = null;
        token.value = "";
        localStorage.removeItem("kaostudio_token");
        localStorage.removeItem("kaostudio_user");
    };

    return {
        user,
        token,
        isLoggedIn,
        isGuest,
        login,
        logout,
    };
});
