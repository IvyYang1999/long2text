/**
 * Client-side image splitting using Canvas API.
 * Splits long images into overlapping segments in the browser
 * so each segment stays under Vercel's 4.5MB upload limit.
 */

export interface ClientSegment {
  index: number;
  yStart: number;
  yEnd: number;
  blob: Blob;
}

export interface SplitInfo {
  width: number;
  height: number;
  segmentHeight: number;
  overlap: number;
  segments: ClientSegment[];
}

function calculateSegmentHeight(width: number): number {
  // Shorter segments for wider images to keep file size under 4.5MB
  if (width <= 500) return 1500;
  if (width <= 800) return 1200;
  if (width <= 1200) return 1000;
  return 800;
}

export async function splitImageInBrowser(
  file: File,
  overlap = 200,
): Promise<SplitInfo> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: width, naturalHeight: height } = img;
      const segmentHeight = calculateSegmentHeight(width);

      // Short image - no splitting needed
      if (height <= segmentHeight * 1.3) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Failed to create blob"));
            resolve({
              width,
              height,
              segmentHeight: height,
              overlap: 0,
              segments: [{ index: 0, yStart: 0, yEnd: height, blob }],
            });
          },
          "image/png",
          1.0,
        );
        return;
      }

      const step = segmentHeight - overlap;
      const segments: ClientSegment[] = [];
      let y = 0;
      let i = 0;

      const cropSegment = (
        yStart: number,
        yEnd: number,
        idx: number,
      ): Promise<ClientSegment> => {
        return new Promise((res, rej) => {
          const cropH = yEnd - yStart;
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = cropH;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, yStart, width, cropH, 0, 0, width, cropH);

          canvas.toBlob(
            (blob) => {
              if (!blob) return rej(new Error("Failed to crop segment"));
              res({ index: idx, yStart, yEnd, blob });
            },
            "image/png",
            1.0,
          );
        });
      };

      while (y < height) {
        const yEnd = Math.min(y + segmentHeight, height);
        segments.push(await cropSegment(y, yEnd, i));
        y += step;
        i++;
      }

      resolve({ width, height, segmentHeight, overlap, segments });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
