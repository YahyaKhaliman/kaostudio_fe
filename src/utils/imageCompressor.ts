/**
 * Utilitas untuk mengompresi gambar kustom dari user sebelum dimasukkan ke canvas/storage.
 * Berfungsi sebagai pengaman ukuran memori dan mencegah crash browser akibat file raksasa.
 */

interface CompressionResult {
  dataUrl: string
  blob: Blob
  width: number
  height: number
  originalSize: number
  compressedSize: number
}

/**
 * Mengompresi file gambar menggunakan Canvas HTML5
 * @param file File gambar asli dari input user
 * @param maxDimension Dimensi maksimum lebar/tinggi (default 1000px)
 * @param quality Kualitas kompresi 0.0 sampai 1.0 (default 0.8)
 */
export const compressImage = (
  file: File,
  maxDimension = 1000,
  quality = 0.8
): Promise<CompressionResult> => {
  return new Promise((resolve, reject) => {
    // Validasi tipe file
    if (!file.type.startsWith('image/')) {
      return reject(new Error('File yang diunggah harus berupa gambar.'))
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        try {
          const originalWidth = img.width
          const originalHeight = img.height
          let targetWidth = originalWidth
          let targetHeight = originalHeight

          // Hitung rasio aspek untuk pengecilan skala
          if (originalWidth > maxDimension || originalHeight > maxDimension) {
            if (originalWidth > originalHeight) {
              targetWidth = maxDimension
              targetHeight = Math.round((originalHeight * maxDimension) / originalWidth)
            } else {
              targetHeight = maxDimension
              targetWidth = Math.round((originalWidth * maxDimension) / originalHeight)
            }
          }

          // Buat canvas sementara untuk merender ulang gambar
          const canvas = document.createElement('canvas')
          canvas.width = targetWidth
          canvas.height = targetHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            return reject(new Error('Gagal mendapatkan context 2D untuk kompresi.'))
          }

          // Gambar ulang dengan interpolasi tinggi
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

          // Tentukan format kompresi (pertahankan transparansi untuk PNG/SVG/WEBP)
          const isTransparentFormat = file.type === 'image/png' || file.type === 'image/svg+xml' || file.type === 'image/webp'
          const exportType = isTransparentFormat ? 'image/png' : 'image/jpeg'

          // Konversi ke Data URL
          const dataUrl = canvas.toDataURL(exportType, quality)

          // Konversi ke Blob untuk menghitung ukuran byte terkompresi
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return reject(new Error('Gagal melakukan kompresi blob.'))
              }
              resolve({
                dataUrl,
                blob,
                width: targetWidth,
                height: targetHeight,
                originalSize: file.size,
                compressedSize: blob.size
              })
            },
            exportType,
            quality
          )
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = () => reject(new Error('Gagal memuat gambar untuk kompresi.'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'))
    reader.readAsDataURL(file)
  })
}

/**
 * Mengubah format ukuran bytes menjadi format yang mudah dibaca manusia (KB/MB)
 */
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + (sizes[i] ?? '')
}
