// checkin-daily/frontend/utils/image-compressor.ts
// Intelligent Client-Side Image Resizing & WebP Compression Pipeline
// Prevents Cloudflare D1 statement size overflows by compressing multi-megabyte images
// down to high-definition WebP (typically 150KB ~ 350KB) before transmission.

export interface CompressedImageResult {
  filename: string
  mimeType: string
  base64Data: string // raw base64 string without data: prefix
  dataUrl: string   // full data:image/webp;base64,... URL
  sizeBytes: number
  originalSizeBytes: number
  width: number
  height: number
  compressionRatio: number
}

/**
 * Compresses an image File or Blob to optimized WebP format with max dimension constraints.
 * Falls back to JPEG if WebP canvas export is not natively supported.
 */
export async function compressImageToWebP(
  file: File | Blob,
  fileName = 'image.jpg',
  maxDimension = 1600,
  initialQuality = 0.82
): Promise<CompressedImageResult> {
  const originalSize = file.size

  // If running on server or no window/canvas, return raw FileReader fallback
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const rawBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(rawBuffer).toString('base64')
    return {
      filename: fileName,
      mimeType: file.type || 'image/jpeg',
      base64Data: base64,
      dataUrl: `data:${file.type || 'image/jpeg'};base64,${base64}`,
      sizeBytes: originalSize,
      originalSizeBytes: originalSize,
      width: 0,
      height: 0,
      compressionRatio: 1,
    }
  }

  // Load image into an HTMLImageElement
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('이미지를 디코딩하지 못했습니다.'))
    image.src = dataUrl
  })

  // Calculate scaled dimensions
  let { width, height } = img
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width)
      width = maxDimension
    } else {
      width = Math.round((width * maxDimension) / height)
      height = maxDimension
    }
  }

  // Render to canvas
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D 컨텍스트를 생성할 수 없습니다.')
  }

  // High quality image smoothing
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)

  // Try WebP compression first
  let targetMime = 'image/webp'
  let quality = initialQuality
  let compressedDataUrl = canvas.toDataURL(targetMime, quality)

  // Check if browser actually produced WebP
  if (!compressedDataUrl.startsWith('data:image/webp')) {
    targetMime = 'image/jpeg'
    compressedDataUrl = canvas.toDataURL(targetMime, quality)
  }

  // If still too large (> 850KB), apply secondary pass with lower quality
  const approxSizeBytes = Math.round((compressedDataUrl.length - 22) * 0.75)
  if (approxSizeBytes > 850 * 1024 && quality > 0.6) {
    quality = 0.68
    compressedDataUrl = canvas.toDataURL(targetMime, quality)
  }

  const commaIndex = compressedDataUrl.indexOf(',')
  const base64Data = commaIndex >= 0 ? compressedDataUrl.substring(commaIndex + 1) : compressedDataUrl
  const finalSize = Math.round(base64Data.length * 0.75)

  // WebP extension
  const cleanBaseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_')
  const ext = targetMime === 'image/webp' ? '.webp' : '.jpg'
  const finalFilename = `${cleanBaseName}${ext}`

  return {
    filename: finalFilename,
    mimeType: targetMime,
    base64Data,
    dataUrl: compressedDataUrl,
    sizeBytes: finalSize,
    originalSizeBytes: originalSize,
    width,
    height,
    compressionRatio: originalSize > 0 ? parseFloat((finalSize / originalSize).toFixed(2)) : 1,
  }
}

