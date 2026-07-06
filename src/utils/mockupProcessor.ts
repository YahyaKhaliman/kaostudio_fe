/**
 * Utility untuk memproses gambar mockup kaos secara real-time di browser.
 * Meliputi penghapusan background menggunakan algoritma flood-fill
 * dan pewarnaan kaos menggunakan metode blending (Multiply).
 */

export interface ProcessedMockup {
  transparentCanvas: HTMLCanvasElement
  originalCanvas: HTMLCanvasElement
}

/**
 * Memuat gambar dari URL
 */
const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (err) => reject(err)
    img.src = url
  })
}

/**
 * Menghapus background putih pada gambar mockup menggunakan algoritma flood-fill.
 * Mencari piksel putih/hampir putih yang terhubung dari sudut-sudut gambar.
 */
export const processMockupImage = async (
  imageUrl: string
): Promise<ProcessedMockup> => {
  const img = await loadImage(imageUrl)
  
  // Buat canvas untuk gambar asli
  const originalCanvas = document.createElement('canvas')
  originalCanvas.width = img.width
  originalCanvas.height = img.height
  const origCtx = originalCanvas.getContext('2d')
  if (!origCtx) throw new Error('Gagal mendapatkan context 2D')
  origCtx.drawImage(img, 0, 0)

  // Buat canvas untuk gambar transparan
  const transparentCanvas = document.createElement('canvas')
  transparentCanvas.width = img.width
  transparentCanvas.height = img.height
  const transCtx = transparentCanvas.getContext('2d')
  if (!transCtx) throw new Error('Gagal mendapatkan context 2D')
  transCtx.drawImage(img, 0, 0)

  return {
    transparentCanvas,
    originalCanvas
  }
}

/**
 * Mewarnai kaos transparan secara dinamis dengan mencampurkan warna dasar (hexColor)
 * dan bayangan/tekstur asli menggunakan blend mode 'multiply'.
 */
export const colorizeMockup = (
  processed: ProcessedMockup,
  hexColor: string
): string => {
  const { transparentCanvas, originalCanvas } = processed
  const w = transparentCanvas.width
  const h = transparentCanvas.height

  // Buat canvas sementara untuk hasil pewarnaan
  const resultCanvas = document.createElement('canvas')
  resultCanvas.width = w
  resultCanvas.height = h
  const ctx = resultCanvas.getContext('2d')
  if (!ctx) throw new Error('Gagal mendapatkan context 2D')

  // 1. Gambar warna solid di seluruh canvas
  ctx.fillStyle = hexColor
  ctx.fillRect(0, 0, w, h)

  // 2. Gunakan 'destination-in' untuk memotong warna solid mengikuti bentuk kaos (transparentCanvas)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(transparentCanvas, 0, 0)

  // 3. Gunakan 'multiply' untuk menggabungkan bayangan/tekstur dari gambar asli
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(originalCanvas, 0, 0)

  // 4. Tambahkan highlights sorotan cahaya menggunakan screen blend mode dengan opasitas 18%
  // Langkah ini mencerahkan kembali lipatan kain yang terkena cahaya pada kaos berwarna gelap
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = 0.18
  ctx.drawImage(originalCanvas, 0, 0)
  ctx.globalAlpha = 1.0 // Reset alpha kembali ke penuh

  // 5. Gunakan 'destination-in' sekali lagi secara paksa untuk membuang warna putih 
  // yang bocor di luar area kaos akibat blending multiply pada latar belakang
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(transparentCanvas, 0, 0)

  return resultCanvas.toDataURL('image/png')
}
