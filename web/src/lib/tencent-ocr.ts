/**
 * Tencent Cloud OCR API client using raw HTTP (TC3-HMAC-SHA256).
 * The official SDK has a bug where Authorization header contains newlines,
 * which breaks on Vercel's Node.js 18+ (undici strict header validation).
 */
import crypto from "crypto";

export interface OCRBlock {
  text: string;
  confidence: number;
  y: number;
  x: number;
}

function sha256(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function getDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

/**
 * Run OCR on an image buffer using Tencent Cloud GeneralBasicOCR.
 */
export async function ocrImage(imageBuffer: Buffer): Promise<OCRBlock[]> {
  const secretId = process.env.TENCENT_SECRET_ID?.trim();
  const secretKey = process.env.TENCENT_SECRET_KEY?.trim();

  if (!secretId || !secretKey) {
    throw new Error("Missing TENCENT_SECRET_ID or TENCENT_SECRET_KEY");
  }

  const service = "ocr";
  const host = "ocr.tencentcloudapi.com";
  const action = "GeneralBasicOCR";
  const version = "2018-11-19";
  const region = "ap-beijing";
  const timestamp = Math.floor(Date.now() / 1000);
  const date = getDate(timestamp);

  const payload = JSON.stringify({
    ImageBase64: imageBuffer.toString("base64"),
    LanguageType: "auto",
  });

  // Step 1: Build canonical request
  const httpRequestMethod = "POST";
  const canonicalUri = "/";
  const canonicalQueryString = "";
  const contentType = "application/json; charset=utf-8";
  const canonicalHeaders =
    `content-type:${contentType}\n` + `host:${host}\n`;
  const signedHeaders = "content-type;host";
  const hashedPayload = sha256(payload);
  const canonicalRequest = [
    httpRequestMethod,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join("\n");

  // Step 2: Build string to sign
  const algorithm = "TC3-HMAC-SHA256";
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    algorithm,
    timestamp.toString(),
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  // Step 3: Calculate signature
  const secretDate = hmacSha256(`TC3${secretKey}`, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, "tc3_request");
  const signature = crypto
    .createHmac("sha256", secretSigning)
    .update(stringToSign)
    .digest("hex");

  // Step 4: Build authorization (single line, no newlines!)
  const authorization =
    `${algorithm} Credential=${secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  const resp = await fetch(`https://${host}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Host: host,
      Authorization: authorization,
      "X-TC-Action": action,
      "X-TC-Version": version,
      "X-TC-Timestamp": timestamp.toString(),
      "X-TC-Region": region,
    },
    body: payload,
  });

  const data = await resp.json();

  if (data.Response?.Error) {
    throw new Error(
      `Tencent OCR error: ${data.Response.Error.Code} - ${data.Response.Error.Message}`,
    );
  }

  const detections = data.Response?.TextDetections;
  if (!detections) return [];

  return detections.map(
    (det: {
      DetectedText?: string;
      Confidence?: number;
      ItemPolygon?: { Y?: number; X?: number };
    }) => ({
      text: det.DetectedText || "",
      confidence: det.Confidence || 0,
      y: det.ItemPolygon?.Y || 0,
      x: det.ItemPolygon?.X || 0,
    }),
  );
}
