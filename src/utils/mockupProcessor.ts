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
 * Opsional: Melindungi area tag agar tidak ikut terwarnai dengan menyalin dan menimpa kembali area tersebut.
 */
export const colorizeMockup = (
  canvas: HTMLCanvasElement,
  hexColor: string,
  tagBox?: { left: number; top: number; width: number; height: number }
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

  // 6. Kembalikan piksel merah (logo asli) dari canvas asli ke atas canvas hasil pewarnaan secara piksel demi piksel
  if (tagBox) {
    const actualLeft = Math.round(tagBox.left * w)
    const actualTop = Math.round(tagBox.top * h)
    const actualWidth = Math.round(tagBox.width * w)
    const actualHeight = Math.round(tagBox.height * h)

    const origCtx = canvas.getContext('2d')
    if (origCtx) {
      const origData = origCtx.getImageData(actualLeft, actualTop, actualWidth, actualHeight)
      const resData = ctx.getImageData(actualLeft, actualTop, actualWidth, actualHeight)

      const pixels = actualWidth * actualHeight
      for (let i = 0; i < pixels; i++) {
        const idx = i * 4
        const x = i % actualWidth
        const y = Math.floor(i / actualWidth)

        const r = origData.data[idx] ?? 0
        const g = origData.data[idx + 1] ?? 0
        const b = origData.data[idx + 2] ?? 0
        const a = origData.data[idx + 3] ?? 0

        // Deteksi piksel berwarna merah pada bingkai logo
        const isRed = r - g > 40 && r - b > 40
        
        // Deteksi piksel berwarna putih/abu-abu terang (tulisan KAOSAN & background dalam logo)
        // Kita batasi area dalam logo (relX & relY antara 0.12 dan 0.88) untuk menghindari piksel kain luar di sudut kotak
        const relX = x / actualWidth
        const relY = y / actualHeight
        const isInsideLogo = relX >= 0.12 && relX <= 0.88 && relY >= 0.12 && relY <= 0.88
        const isWhite = r > 150 && g > 150 && b > 150 && Math.abs(r - g) < 20 && Math.abs(r - b) < 20

        if ((isRed || (isWhite && isInsideLogo)) && a > 10) {
          resData.data[idx] = r
          resData.data[idx + 1] = g
          resData.data[idx + 2] = b
          resData.data[idx + 3] = a
        }
      }
      ctx.putImageData(resData, actualLeft, actualTop)
    }
  }

  return resultCanvas.toDataURL('image/png')
}
