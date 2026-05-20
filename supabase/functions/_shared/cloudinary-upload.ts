/**
 * Shared Cloudflare R2 upload helper for edge functions.
 * Uploads a base64 image (data URL or raw base64) to R2 via S3-compatible API and returns the public URL.
 * Falls back to the original data URL if upload fails.
 */
type R2UploadSource = string | { bytes: Uint8Array; contentType?: string } | { stream: ReadableStream<Uint8Array>; contentType?: string };

export async function uploadToR2(
  imageSource: R2UploadSource,
  options?: { folder?: string; filename?: string }
): Promise<{ url: string; key: string; uploaded: boolean }> {
  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const bucketName = Deno.env.get('R2_BUCKET_NAME');
  const publicUrl = Deno.env.get('R2_PUBLIC_URL'); // e.g. https://pub-xxx.r2.dev or custom domain

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    console.warn('R2 credentials not fully configured, falling back to source');
    return { url: typeof imageSource === 'string' ? imageSource : '', key: '', uploaded: false };
  }

  try {
    // Parse image data
    let imageBytes: Uint8Array | null = null;
    let imageStream: ReadableStream<Uint8Array> | null = null;
    let contentType = 'image/png';

    if (typeof imageSource !== 'string' && 'stream' in imageSource) {
      imageStream = imageSource.stream;
      contentType = imageSource.contentType || contentType;
    } else if (typeof imageSource !== 'string') {
      imageBytes = imageSource.bytes;
      contentType = imageSource.contentType || contentType;
    } else if (imageSource.startsWith('data:')) {
      const mimeMatch = imageSource.match(/^data:(image\/\w+);base64,/);
      if (mimeMatch) contentType = mimeMatch[1];
      const base64Data = imageSource.split(',')[1];
      imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    } else {
      imageBytes = Uint8Array.from(atob(imageSource), c => c.charCodeAt(0));
    }

    // Build the object key
    const folder = options?.folder || 'arris-engine';
    const filename = options?.filename || `${crypto.randomUUID()}.png`;
    const objectKey = `${folder}/${filename}`;

    // S3-compatible PUT to R2
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${objectKey}`;
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const shortDate = dateStamp.substring(0, 8);
    const region = 'auto';
    const service = 's3';

    // AWS Signature V4
    const encoder = new TextEncoder();

    async function hmacSHA256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
      // Cast to BufferSource — TS 5.7's stricter typing distinguishes
      // SharedArrayBuffer from ArrayBuffer; we know our buffer is the latter.
      const keyData = (key instanceof Uint8Array ? key : new Uint8Array(key)) as BufferSource;
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData,
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    }

    async function sha256(data: Uint8Array): Promise<string> {
      const hash = await crypto.subtle.digest('SHA-256', data as BufferSource);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const payloadHash = imageBytes ? await sha256(imageBytes) : 'UNSIGNED-PAYLOAD';
    const host = `${accountId}.r2.cloudflarestorage.com`;

    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${dateStamp}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = [
      'PUT',
      `/${bucketName}/${objectKey}`,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${shortDate}/${region}/${service}/aws4_request`;
    const canonicalRequestHash = await sha256(encoder.encode(canonicalRequest));

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      dateStamp,
      credentialScope,
      canonicalRequestHash,
    ].join('\n');

    // Derive signing key
    const kDate = await hmacSHA256(encoder.encode(`AWS4${secretAccessKey}`), shortDate);
    const kRegion = await hmacSHA256(kDate, region);
    const kService = await hmacSHA256(kRegion, service);
    const kSigning = await hmacSHA256(kService, 'aws4_request');

    const signatureBuffer = await hmacSHA256(kSigning, stringToSign);
    const signature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Host': host,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': dateStamp,
        'Authorization': authorization,
      },
      body: imageBytes ?? imageStream,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('R2 upload failed:', response.status, errorText);
      return { url: typeof imageSource === 'string' ? imageSource : '', key: '', uploaded: false };
    }

    const finalUrl = `${publicUrl.replace(/\/$/, '')}/${objectKey}`;
    console.log('R2 upload success:', objectKey);

    return { url: finalUrl, key: objectKey, uploaded: true };
  } catch (error) {
    console.error('R2 upload error:', error);
    return { url: typeof imageSource === 'string' ? imageSource : '', key: '', uploaded: false };
  }
}
