<script setup lang="ts">
/**
 * Universal Image Input Component
 * Handles file uploads and external URLs for both Users and Thinkers.
 */

const props = defineProps<{
  modelValue?: string | null
  label?: string
  alt?: string
  aspect?: 'square' | 'portrait' | 'avatar'
  allowUrl?: boolean
  help?: string
  defer?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

// State
const inputMode = ref<'upload' | 'url'>('upload')
const manualUrl = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const previewUrl = ref('') // Local preview for immediate feedback
const pendingFile = ref<File | null>(null)

// Composable
const { isUploading, handleFileChange: originalHandleChange, uploadFile } = useImageUpload({
  onSuccess: (url) => {
    emit('update:modelValue', url)
  }
})

// Intercept file change to show preview immediately
async function onFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]
    // Create local preview
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value) // Cleanup old
    previewUrl.value = URL.createObjectURL(file)

    // Proceed with upload or defer
    if (props.defer) {
      pendingFile.value = file
    } else {
      await originalHandleChange(event)
    }
  }
}

/**
 * Trigger the upload of a pending file manually.
 * Returns the URL on success, or null on failure.
 */
async function upload(): Promise<string | null> {
  if (pendingFile.value) {
    return await uploadFile(pendingFile.value)
  }
  return props.modelValue || null
}

defineExpose({
  upload,
  reset: clear,
  resetPending
})

// Validation for URL
const urlError = ref('')
function validateUrl() {
  if (!manualUrl.value) return

  try {
    const url = new URL(manualUrl.value.trim())
    if (!['http:', 'https:'].includes(url.protocol)) {
      urlError.value = 'Must start with http:// or https://'
      return
    }
    // Clear local preview if switching to URL
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = ''
    }
    pendingFile.value = null

    emit('update:modelValue', manualUrl.value)
    urlError.value = ''
    manualUrl.value = '' // Clear input on success (it moves to preview)
    inputMode.value = 'upload' // Switch back to preview mode
  } catch {
    urlError.value = 'Invalid URL format'
  }
}

// Aspect Ratio Classes
const aspectClass = computed(() => {
  switch (props.aspect) {
    case 'avatar': return 'rounded-full aspect-square w-32 h-32'
    case 'portrait': return 'rounded-lg aspect-[3/4] w-40'
    case 'square': return 'rounded-lg aspect-square w-40'
    default: return 'rounded-lg aspect-square w-32'
  }
})

function clear() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
  pendingFile.value = null
  emit('update:modelValue', '')
  manualUrl.value = ''
  urlError.value = ''
}

function resetPending() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
  pendingFile.value = null
}

function triggerUpload() {
  fileInput.value?.click()
}

// Cleanup on unmount
onUnmounted(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <div class="space-y-3">
    <!-- Header -->
    <div class="flex flex-col gap-2">
      <!-- Label & Buttons -->
      <div class="flex justify-between items-center min-h-[24px]">
        <label
          v-if="label"
          class="block text-sm font-medium text-stone-700 dark:text-stone-300"
        >
          {{ label }}
        </label>
        <div
          v-else
          class="flex-1"
        >
          <!-- Spacer or Empty -->
        </div>

        <div
          v-if="allowUrl"
          class="flex gap-1"
        >
          <UButton
            size="xs"
            :color="inputMode === 'upload' ? 'primary' : 'neutral'"
            variant="ghost"
            label="Upload"
            @click="inputMode = 'upload'"
          />
          <UButton
            size="xs"
            :color="inputMode === 'url' ? 'primary' : 'neutral'"
            variant="ghost"
            label="Link URL"
            @click="inputMode = 'url'"
          />
        </div>
      </div>
    </div>

    <div class="flex items-start gap-6 p-4 border border-stone-200 dark:border-stone-800 rounded-lg bg-stone-50 dark:bg-stone-900/50">
      <!-- Preview Area -->
      <div
        class="relative overflow-hidden bg-stone-200 dark:bg-stone-800 ring-1 ring-stone-900/5 dark:ring-white/10 shadow-sm shrink-0"
        :class="aspectClass"
      >
        <!-- Current Image -->
        <template v-if="modelValue || previewUrl">
          <!-- Standardized Image -->
          <img
            :src="previewUrl || modelValue || undefined"
            :alt="alt"
            class="w-full h-full object-cover"
          >

          <!-- Clear Button Overlay -->
          <div class="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
            <UButton
              color="error"
              variant="solid"
              icon="i-lucide-trash-2"
              size="xs"
              @click="clear"
            />
          </div>
        </template>

        <!-- Placeholder -->
        <div
          v-else
          class="w-full h-full flex flex-col items-center justify-center text-stone-400 gap-2 p-4 text-center"
        >
          <UIcon
            name="i-lucide-image"
            class="w-8 h-8 opacity-50"
          />
          <span class="text-xs">No image</span>
        </div>

        <!-- Loading Overlay -->
        <div
          v-if="isUploading"
          class="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <UIcon
            name="i-lucide-loader-2"
            class="w-8 h-8 text-white animate-spin"
          />
        </div>
      </div>

      <!-- Controls -->
      <div class="flex-1 space-y-3 min-w-0">
        <!-- Mode: Upload -->
        <div v-if="inputMode === 'upload'">
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onFileSelect"
          >
          <div class="space-y-2">
            <p class="text-sm text-stone-600 dark:text-stone-400">
              Upload a photo from your device.
            </p>
            <div class="flex flex-wrap gap-2">
              <UButton
                color="primary"
                variant="soft"
                icon="i-lucide-upload-cloud"
                label="Choose File"
                :loading="isUploading"
                @click="triggerUpload"
              />
            </div>
            <p class="text-xs text-stone-500">
              Max 5MB. JPG, PNG, GIF, WebP.
            </p>
          </div>
        </div>

        <!-- Mode: URL -->
        <div
          v-else-if="inputMode === 'url'"
          class="space-y-2"
        >
          <p class="text-sm text-stone-600 dark:text-stone-400">
            Link to an external image URL.
          </p>
          <div class="flex gap-2">
            <UInput
              v-model="manualUrl"
              placeholder="https://example.com/image.jpg"
              icon="i-lucide-link"
              class="flex-1"
              :color="urlError ? 'error' : 'neutral'"
              @keyup.enter="validateUrl"
            />
            <UButton
              color="neutral"
              variant="solid"
              icon="i-lucide-check"
              @click="validateUrl"
            />
          </div>
          <p
            v-if="urlError"
            class="text-xs text-red-500"
          >
            {{ urlError }}
          </p>
        </div>

        <!-- Helper Text -->
        <p
          v-if="help"
          class="text-xs text-stone-500 border-t border-stone-200 dark:border-stone-800 pt-2 mt-2"
        >
          {{ help }}
        </p>
      </div>
    </div>
  </div>
</template>
