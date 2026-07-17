export interface KalkulasiPayload {
  jenisKaos: string;
  warnaKaos: string;
  qtyS: number;
  qtyM: number;
  qtyL: number;
  qtyXL: number;
  qtyXXL: number;
  qtyXXXL: number;
  qtyPrintS: number;
  qtyPrintM: number;
  qtyPrintL: number;
  qtyPrintXL: number;
  qtyPrintXXL: number;
  qtyPrintXXXL: number;
  selectedService: string;
  frontDimensions: { width: number; height: number; area: number };
  backDimensions: { width: number; height: number; area: number };
  isPolyflexGold: boolean;
}

export interface KalkulasiResponse {
  activeShirtLabel: string;
  shirtPrices: Record<string, number>;
  servicePrices: {
    front: number;
    back: number;
    total: number;
  };
  billingRows: {
    type: "kaos" | "jasa";
    nama: string;
    qty: number;
    harga: number;
    total: number;
  }[];
  subtotal: number;
}

const API_BASE_URL = "http://localhost:3004/api";

export async function fetchKalkulasiHarga(
  payload: KalkulasiPayload,
): Promise<KalkulasiResponse> {
  const res = await fetch(`${API_BASE_URL}/kalkulasi-harga`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Gagal melakukan kalkulasi harga (HTTP ${res.status})`);
  }

  const result = await res.json();
  if (result && typeof result === "object" && "success" in result && "data" in result) {
    return result.data as KalkulasiResponse;
  }
  return result;
}
