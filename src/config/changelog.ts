export interface ReleaseNote {
    version: string;
    date: string;
    title: string;
    badge?: string;
}

export const changelogHistory: ReleaseNote[] = [
    {
        version: "1.3.5",
        date: "5 Oktober 2026",
        title: "Peningkatan UI dan UX",
        badge: "Versi Terbaru",
    },
];
