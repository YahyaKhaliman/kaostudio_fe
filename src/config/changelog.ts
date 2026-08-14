export interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  badge?: string;
}

export const changelogHistory: ReleaseNote[] = [
  {
    version: "1.2.2",
    date: "14 Agustus 2026",
    title: "Fitur Mockup Jersey (Custom Motif) & Perbaikan Estimasi Harga",
    badge: "Versi Terbaru",
  },
];
