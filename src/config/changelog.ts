export interface ReleaseNote {
    version: string;
    date: string;
    title: string;
    badge?: string;
}

export const changelogHistory: ReleaseNote[] = [
    {
        version: "1.3.1",
        date: "30 September 2026",
        title: "Fitur PWA & Peningkatan Desain",
        badge: "Versi Terbaru",
    },
];
