/**
 * GramCare AI — Document Image Cropping & Edge Detection Utilities
 * Provides high-resolution offscreen canvas cropping, 90-degree rotations,
 * and heuristic paper-edge detection for medical prescriptions and reports.
 */

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

export function getRadianAngle(degreeValue: number): number {
  return (degreeValue * Math.PI) / 180;
}

/**
 * Returns the new bounding box dimensions of an image rotated by specified degrees.
 */
export function rotateSize(width: number, height: number, rotation: number): { width: number; height: number } {
  const rotRad = getRadianAngle(rotation);
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * Crops a high-resolution image from its original source coordinates and rotation.
 * Preserves high fidelity (JPEG quality 0.95) to keep medical prescriptions readable.
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: CropArea,
  rotation = 0,
  flip = { horizontal: false, vertical: false }
): Promise<{ blob: Blob; dataUrl: string; file: File; width: number; height: number }> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context for image processing');
  }

  const rotRad = getRadianAngle(rotation);

  // Calculate rotated bounding box dimensions
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.naturalWidth,
    image.naturalHeight,
    rotation
  );

  // Set canvas size to the bounding box
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // Translate and rotate around center
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
  ctx.translate(-image.naturalWidth / 2, -image.naturalHeight / 2);

  // Draw full-resolution image onto rotated bounding canvas
  ctx.drawImage(image, 0, 0);

  // Now create the destination canvas for the cropped area
  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');

  if (!croppedCtx) {
    throw new Error('Could not acquire 2D canvas context for cropped output');
  }

  const targetWidth = Math.max(1, Math.round(pixelCrop.width));
  const targetHeight = Math.max(1, Math.round(pixelCrop.height));

  croppedCanvas.width = targetWidth;
  croppedCanvas.height = targetHeight;

  // Draw precisely from the rotated bounding canvas
  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  );

  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Cropped canvas output was empty or invalid'));
          return;
        }
        const dataUrl = croppedCanvas.toDataURL('image/jpeg', 0.95);
        const file = new File([blob], `gramcare_cropped_${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        resolve({ blob, dataUrl, file, width: targetWidth, height: targetHeight });
      },
      'image/jpeg',
      0.95
    );
  });
}

/**
 * Heuristic Document Edge & Paper Boundary Detection
 * Samples the image to locate high-contrast document paper boundaries
 * against darker desks, tables, or background surfaces.
 */
export async function detectDocumentPaperBounds(imageSrc: string): Promise<CropArea | null> {
  try {
    const image = await createImage(imageSrc);
    const origW = image.naturalWidth;
    const origH = image.naturalHeight;

    if (!origW || !origH) return null;

    // Downscale for fast and smooth CPU boundary scanning
    const sampleW = 320;
    const sampleH = Math.round((sampleW / origW) * origH);

    const canvas = document.createElement('canvas');
    canvas.width = sampleW;
    canvas.height = sampleH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(image, 0, 0, sampleW, sampleH);
    const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
    const data = imgData.data;

    // Compute luminance grid
    const lum = new Float32Array(sampleW * sampleH);
    let totalLum = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Perceived luminance formula (ITU-R BT.601)
      const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const idx = i / 4;
      lum[idx] = l;
      totalLum += l;
    }
    const avgLum = totalLum / (sampleW * sampleH);

    // Dynamic threshold: paper is usually brighter than surrounding surfaces
    const threshold = Math.max(120, avgLum * 1.05);

    // Compute column-wise and row-wise counts of paper-like pixels
    const colCounts = new Int32Array(sampleW);
    const rowCounts = new Int32Array(sampleH);

    for (let y = 0; y < sampleH; y++) {
      for (let x = 0; x < sampleW; x++) {
        if (lum[y * sampleW + x] >= threshold) {
          colCounts[x]++;
          rowCounts[y]++;
        }
      }
    }

    // Find boundaries where at least 25% of column/row exceeds threshold
    const minColDensity = sampleH * 0.22;
    const minRowDensity = sampleW * 0.22;

    let left = 0;
    while (left < sampleW && colCounts[left] < minColDensity) left++;

    let right = sampleW - 1;
    while (right > left && colCounts[right] < minColDensity) right--;

    let top = 0;
    while (top < sampleH && rowCounts[top] < minRowDensity) top++;

    let bottom = sampleH - 1;
    while (bottom > top && rowCounts[bottom] < minRowDensity) bottom--;

    const detectedW = right - left;
    const detectedH = bottom - top;

    // Check if detected area is meaningful (> 25% and < 98% of total area)
    const areaRatio = (detectedW * detectedH) / (sampleW * sampleH);
    if (areaRatio >= 0.25 && areaRatio <= 0.98) {
      // Add safe 2% margin to avoid clipping prescription text
      const marginX = Math.round(detectedW * 0.02);
      const marginY = Math.round(detectedH * 0.02);

      const safeLeft = Math.max(0, left - marginX);
      const safeRight = Math.min(sampleW, right + marginX);
      const safeTop = Math.max(0, top - marginY);
      const safeBottom = Math.min(sampleH, bottom + marginY);

      const scaleX = origW / sampleW;
      const scaleY = origH / sampleH;

      return {
        x: Math.round(safeLeft * scaleX),
        y: Math.round(safeTop * scaleY),
        width: Math.round((safeRight - safeLeft) * scaleX),
        height: Math.round((safeBottom - safeTop) * scaleY),
      };
    }

    // Default centered document suggestion (88% width, 88% height)
    const insetMarginX = Math.round(origW * 0.06);
    const insetMarginY = Math.round(origH * 0.06);
    return {
      x: insetMarginX,
      y: insetMarginY,
      width: Math.round(origW - 2 * insetMarginX),
      height: Math.round(origH - 2 * insetMarginY),
    };
  } catch (err) {
    console.warn('[GramCare Auto-Detection] Edge detection failed:', err);
    return null;
  }
}
