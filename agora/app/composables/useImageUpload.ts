/**
 * Image upload composable
 * Provides a standardized way to upload images to MinIO storage
 */
import type { Ref } from 'vue'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

interface UseImageUploadOptions {
  /** Called when upload starts */
  onStart?: () => void
  /** Called when upload completes with URL */
  onSuccess?: (url: string) => void
  /** Called on upload error */
  onError?: (error: string) => void
  /** Called when upload finishes (success or error) */
  onFinally?: () => void
}

interface UseImageUploadReturn {
  /** Reactive uploading state */
  isUploading: Ref<boolean>
  /** Handle file input change event */
  handleFileChange: (event: Event) => Promise<void>
  /** Programmatically upload a file */
  uploadFile: (file: File) => Promise<string | null>
}

/**
 * Composable for uploading images to MinIO
 *
 * @example
 * ```ts
 * const { isUploading, handleFileChange } = useImageUpload({
 *   onSuccess: (url) => { state.avatar = url },
 *   onError: (msg) => { toast.add({ title: 'Error', description: msg, color: 'error' }) }
 * })
 * ```
 */
export function useImageUpload(options: UseImageUploadOptions = {}): UseImageUploadReturn {
  const isUploading = ref(false)
  const toast = useToast()

  async function uploadFile(file: File): Promise<string | null> {
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      const error = 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'
      options.onError?.(error)
      toast.add({ title: 'Invalid file type', description: error, color: 'error' })
      return null
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const error = 'File too large. Maximum size is 5MB.'
      options.onError?.(error)
      toast.add({ title: 'File too large', description: error, color: 'error' })
      return null
    }

    isUploading.value = true
    options.onStart?.()

    try {
      const formData = new FormData()
      formData.append('file', file)

      const data = await $fetch<{ url: string }>('/api/upload', {
        method: 'POST',
        body: formData
      })

      options.onSuccess?.(data.url)
      toast.add({ title: 'Photo uploaded!', description: 'Click "Save" to apply.', color: 'success' })
      return data.url
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Upload failed'
      options.onError?.(message)
      toast.add({ title: 'Upload failed', description: message, color: 'error' })
      return null
    } finally {
      isUploading.value = false
      options.onFinally?.()
    }
  }

  async function handleFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    if (!input.files || input.files.length === 0) return

    const file = input.files[0]
    if (file) {
      await uploadFile(file)
    }
  }

  return {
    isUploading,
    handleFileChange,
    uploadFile
  }
}
