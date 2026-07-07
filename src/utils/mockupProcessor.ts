/**
 * Utility untuk memproses gambar mockup kaos secara real-time di browser.
 * Meliputi pemuatan gambar dan pewarnaan menggunakan metode blending (Multiply/Screen).
 */

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
 * Memuat gambar mockup kaos ke Canvas HTML5
 */
export const processMockupImage = async (
  imageUrl: string
): Promise<HTMLCanvasElement> => {
  const img = await loadImage(imageUrl)
  
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Gagal mendapatkan context 2D')
  ctx.drawImage(img, 0, 0)

  return canvas
}

/**
 * Mewarnai kaos transparan secara dinamis dengan mencampurkan warna dasar (hexColor)
 * dan bayangan/tekstur asli menggunakan blend mode 'multiply'.
 */
export const colorizeMockup = (
  canvas: HTMLCanvasElement,
  hexColor: string
): string => {
  const w = canvas.width
  const h = canvas.height

  // Buat canvas sementara untuk hasil pewarnaan
  const resultCanvas = document.createElement('canvas')
  resultCanvas.width = w
  resultCanvas.height = h
  const ctx = resultCanvas.getContext('2d')
  if (!ctx) throw new Error('Gagal mendapatkan context 2D')

  // 1. Gambar warna solid di seluruh canvas
  ctx.fillStyle = hexColor
  ctx.fillRect(0, 0, w, h)

  // 2. Gunakan 'destination-in' untuk memotong warna solid mengikuti bentuk kaos
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(canvas, 0, 0)

  // 3. Gunakan 'multiply' untuk menggabungkan bayangan/tekstur dari gambar asli
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(canvas, 0, 0)

  // 4. Tambahkan highlights sorotan cahaya menggunakan screen blend mode dengan opasitas 18%
  // Langkah ini mencerahkan kembali lipatan kain yang terkena cahaya pada kaos berwarna gelap
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = 0.18
  ctx.drawImage(canvas, 0, 0)
  ctx.globalAlpha = 1.0 // Reset alpha kembali ke penuh

  // 5. Gunakan 'destination-in' sekali lagi secara paksa untuk membuang warna putih 
  // yang bocor di luar area kaos akibat blending multiply pada latar belakang
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(canvas, 0, 0)

  return resultCanvas.toDataURL('image/png')
}
