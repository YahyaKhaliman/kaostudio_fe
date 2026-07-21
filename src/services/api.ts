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
  frontService?: string;
  backService?: string;
  designItems?: Array<{
    id: string;
    side: "front" | "back";
    label: string;
    width: number;
    height: number;
    area: number;
    service: string;
  }>;
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

export interface UkuranHarga {
  ukuran: string;
  harga: number;
}

export interface ProductItem {
  brg_kode: string;
  brg_nama: string;
  brg_warna: string;
  brg_jeniskaos: "KO" | "KK";
  brg_tipe: string;
  brg_lengan: "PENDEK" | "PANJANG";
  brg_jeniskain: string;
  ukuran_list: UkuranHarga[];
}

export interface ProductGroupResponse {
  items: Record<string, ProductItem[]>; // Key: COMBED, POLO LACOS CVC
  total: number;
}

export interface ModelWarnaMap {
  tshirt: string[];
  longTshirt: string[];
  polo: string[];
}

export type WarnaTersediaResponse = Record<string, ModelWarnaMap>; // Key: COMBED, POLO LACOS CVC

export interface TarifJasaItem {
  nama_jasa: string;
  tarif_per_cm: number;
  minimal_tarif: number;
}

export interface SaveDesignPayload {
  id?: string;
  canvasState: string;
  shirtColor: string;
  viewType: "front" | "back";
  csNameTemp?: string;
  csPhoneTemp?: string;
}

export interface SaveDesignResponse {
  id: string;
  shirtColor: string;
  viewType: string;
  csNameTemp: string;
  csPhoneTemp: string;
  expiresAt: string;
}

export interface GetDesignResponse {
  id: string;
  canvasState: string;
  shirtColor: string;
  viewType: "front" | "back";
  csNameTemp: string;
  csPhoneTemp: string;
  createdAt: string;
  expiresAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
  if (
    result &&
    typeof result === "object" &&
    "success" in result &&
    "data" in result
  ) {
    return result.data as KalkulasiResponse;
  }
  return result;
}

export async function fetchProduk(): Promise<ProductGroupResponse> {
  const res = await fetch(`${API_BASE_URL}/produk`);
  if (!res.ok) {
    throw new Error(`Gagal mengambil data produk (HTTP ${res.status})`);
  }
  const result = await res.json();
  return result.data as ProductGroupResponse;
}

export async function fetchWarnaTersedia(): Promise<WarnaTersediaResponse> {
  const res = await fetch(`${API_BASE_URL}/warna`);
  if (!res.ok) {
    throw new Error(`Gagal mengambil data warna tersedia (HTTP ${res.status})`);
  }
  const result = await res.json();
  return result.data as WarnaTersediaResponse;
}

export async function fetchTarifJasa(): Promise<TarifJasaItem[]> {
  const res = await fetch(`${API_BASE_URL}/tarif-jasa`);
  if (!res.ok) {
    throw new Error(`Gagal mengambil data tarif jasa (HTTP ${res.status})`);
  }
  const result = await res.json();
  return result.data as TarifJasaItem[];
}

export async function saveMockupDesign(
  payload: SaveDesignPayload,
): Promise<SaveDesignResponse> {
  const res = await fetch(`${API_BASE_URL}/designs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Gagal menyimpan mockup desain (HTTP ${res.status})`);
  }

  const result = await res.json();
  return result.data as SaveDesignResponse;
}
export async function fetchMockupDesign(
  id: string,
): Promise<GetDesignResponse> {
  const res = await fetch(`${API_BASE_URL}/designs/${id}`);
  if (!res.ok) {
    throw new Error(`Gagal memuat mockup desain (HTTP ${res.status})`);
  }
  const result = await res.json();
  return result.data as GetDesignResponse;
}

export async function fetchLookupProducts(term: string = ""): Promise<any[]> {
  const res = await fetch(
    `${API_BASE_URL}/lookup/products?term=${encodeURIComponent(term)}`,
  );
  if (!res.ok) {
    throw new Error(`Gagal memuat lookup produk (HTTP ${res.status})`);
  }
  const result = await res.json();
  return result.data || [];
}

export async function fetchLookupCustomers(
  term: string = "",
): Promise<{ items: any[]; total: number }> {
  const res = await fetch(
    `${API_BASE_URL}/lookup/customers?term=${encodeURIComponent(term)}`,
  );
  if (!res.ok) {
    throw new Error(`Gagal memuat lookup customer (HTTP ${res.status})`);
  }
  const result = await res.json();
  return result.data || { items: [], total: 0 };
}

export async function savePenawaran(payload: any): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/penawaran`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await res.json();

  if (!res.ok || result.success === false) {
    throw new Error(
      result.message || `Gagal menyimpan penawaran (HTTP ${res.status})`,
    );
  }

  return result.data || result;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number | string;
    username: string;
    nama: string;
    role: string;
  };
}

export async function loginAdmin(
  payload: LoginPayload,
): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Gagal login (HTTP ${res.status})`);
  }

  const result = await res.json();
  return result.data || result;
}
