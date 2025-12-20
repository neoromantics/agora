import { getMinioClient, getMinioBucket, isMinioEnabled } from '../utils/minio'

export default defineNitroPlugin(async (_nitroApp) => {
  // Wait for config to be ready
  if (!isMinioEnabled()) {
    console.warn('[MinIO] Not configured (skipping bucket initialization)')
    return
  }

  try {
    const client = getMinioClient()
    const bucket = getMinioBucket()

    const exists = await client.bucketExists(bucket)
    if (!exists) {
      await client.makeBucket(bucket, 'us-east-1') // Region is optional but good practice

      // Set policy to public read for avatars/ etc if needed?
      // Actually, we proxy images via /api/img, so we don't need public bucket policy.
      // We keep it private for security.
    } else {
      console.log(`[MinIO] Connected to bucket '${bucket}'`)
    }
  } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error('[MinIO] Initialization failed:', e.message)
    // We don't crash the server because MinIO might be starting up.
    // Ideally we retry? But kept simple for now.
  }
})
