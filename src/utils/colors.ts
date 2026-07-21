export interface ColorItem {
    name: string;
    hex: string;
}

// Preset warna kaos terlaris perusahaan (akses cepat)
export const presetColors: ColorItem[] = [
    { name: "Putih", hex: "#FFFFFF" },
    { name: "Hitam", hex: "#1C1C1C" },
    { name: "Abu Misty", hex: "#D7D7D2" },
    { name: "Navy", hex: "#1F2F59" },
    { name: "Merah Cabe", hex: "#A4282E" },
    { name: "Dutch Blue", hex: "#2E5FA7" },
    { name: "Turkish Blue", hex: "#2CA7C9" },
    { name: "Kuning Emas", hex: "#E6B933" },
];

// Mapping alias nama warna dari DB yang berbeda ejaan/format ke nama standar di companyColors
// Key: nama DB (UPPERCASE), Value: nama standar di companyColors
export const colorAliases: Record<string, string> = {
    "KHEKY": "Khaky",
    "MARUN": "Maroon",
    "PICH": "Peach",
    "SEAGREEN": "Sea Green",
    "WOODROSE": "Wood Rose",
    "STILL BLUE": "Steel Blue",
    "NAVY/DONGKER": "Navy",
    "KENARI": "Kuning Kenari",
    "MINERAL": "Mineral Blue",
    "OLD ABU MISTY": "Abu Misty",
    "OLD DEEPBLUE": "Deep Blue",
    "OLD GRAPE NECTAR": "Grape Nectar",
    "OLD SEAGREEN": "Sea Green",
    "HIJAU SAMPURNA": "Hijau Sempurna",
    "TURKISH MUDA": "Turkis Muda",
};

// Daftar lengkap warna valid yang tersedia di perusahaan (termasuk warna baru dari DB)
export const companyColors: ColorItem[] = [
    // === Putih / Abu / Netral ===
    { name: "Putih", hex: "#FFFFFF" },
    { name: "Off White", hex: "#F6F3EC" },
    { name: "Hitam", hex: "#1C1C1C" },
    { name: "Stone Grey", hex: "#7D8288" },
    { name: "Abu Muda", hex: "#B8BDC4" },
    { name: "Abu Misty", hex: "#D7D7D2" },

    // === Biru ===
    { name: "Dusty Blue", hex: "#8F9DB4" },
    { name: "Sky Blue", hex: "#9CCBE8" },
    { name: "Mineral Blue", hex: "#5F84A2" },
    { name: "Steel Blue", hex: "#4E6C89" },
    { name: "Dutch Blue", hex: "#2E5FA7" },
    { name: "Deep Blue", hex: "#234A84" },
    { name: "Navy", hex: "#1F2F59" },
    { name: "Benhur", hex: "#1B3D6D" },

    // === Turkis / Tosca ===
    { name: "Turkis Muda", hex: "#8FD8E8" },
    { name: "Turkis Sedang", hex: "#4DBFCF" },
    { name: "Turkish Blue", hex: "#2CA7C9" },
    { name: "Tosca", hex: "#2FA7A2" },
    { name: "Tosca Sedang", hex: "#248F8A" },
    { name: "Tosca Tua", hex: "#1E6F73" },

    // === Hijau ===
    { name: "Aqua Haze", hex: "#D8F0EA" },
    { name: "Sea Green", hex: "#5E8D74" },
    { name: "Mineral Green", hex: "#315B52" },
    { name: "Hijau Botol", hex: "#23463B" },
    { name: "Hijau Fuji", hex: "#5B8A3C" },
    { name: "Hijau Sempurna", hex: "#7E8C36" },
    { name: "Funky Green", hex: "#76B947" },
    { name: "Army", hex: "#3D4A3F" },
    { name: "Olive Green", hex: "#59603D" },
    { name: "Cactus Green", hex: "#2F6B57" },
    { name: "Jade Green", hex: "#1F5C49" },

    // === Kuning / Mustard ===
    { name: "Butter", hex: "#F5E6A3" },
    { name: "Kuning Kenari", hex: "#E7D34F" },
    { name: "Kuning Emas", hex: "#E6B933" },
    { name: "Kuning Kunyit", hex: "#D99A2B" },
    { name: "Mustard", hex: "#C79339" },
    { name: "Dark Mustard", hex: "#8A6A3A" },
    { name: "Dijon", hex: "#B99258" },

    // === Coklat / Krem ===
    { name: "Khaky", hex: "#C7B28A" },
    { name: "Beige", hex: "#C8B69A" },
    { name: "Almond", hex: "#C38E5F" },
    { name: "Light Brown", hex: "#B88F66" },
    { name: "Cinnamon", hex: "#5B4038" },
    { name: "Coklat Polisi", hex: "#6B4423" },
    { name: "Teracota", hex: "#C45A3C" },

    // === Merah / Orange ===
    { name: "Maroon", hex: "#4C232A" },
    { name: "Merah Cabe", hex: "#A4282E" },
    { name: "Orange Bata", hex: "#C35D3B" },

    // === Pink / Peach / Salem ===
    { name: "Baby Pink", hex: "#F4C7D4" },
    { name: "Peach", hex: "#E98D87" },
    { name: "Salem", hex: "#CC8C80" },
    { name: "Dusty", hex: "#D38F92" },
    { name: "Dusty Rose", hex: "#A66E6C" },
    { name: "Blush Red", hex: "#8B4B58" },

    // === Magenta / Ungu ===
    { name: "Magenta", hex: "#C12F72" },
    { name: "Lilac", hex: "#9C7CA8" },
    { name: "Ungu Muda", hex: "#9B72B0" },
    { name: "Ungu Tua", hex: "#5C3074" },
    { name: "Grape Nectar", hex: "#72506D" },

    // === Rose ===
    { name: "Wood Rose", hex: "#B19397" },
    { name: "Rose", hex: "#A88A8A" },
];

