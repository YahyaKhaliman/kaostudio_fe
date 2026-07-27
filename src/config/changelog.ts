export interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  badge?: string;
}

export const changelogHistory: ReleaseNote[] = [
  {
    version: "1.2.0",
    date: "27 Juli 2026",
    title: "Fitur Mockup Jersey (Custom Motif) & Perbaikan Estimasi Harga",
    badge: "Versi Terbaru",
  },
];
