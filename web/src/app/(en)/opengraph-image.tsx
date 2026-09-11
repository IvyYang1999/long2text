import { ogImage, ogSize } from "@/components/OgImage";

export const alt = "Long2Text — long screenshots to clean text";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogImage();
}
