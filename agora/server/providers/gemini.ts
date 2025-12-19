import { GoogleGenerativeAI, type GenerativeModel, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import type { LLMProvider } from './provider'
import { LLM_DEFAULTS } from './provider'

let genAI: GoogleGenerativeAI | null = null
let model: GenerativeModel | null = null
let currentModel: string | null = null

function getClient(): GenerativeModel {
  const config = useRuntimeConfig()
  const modelName = config.llmModel || LLM_DEFAULTS.model

  // Reinitialize if model changed
  if (model && currentModel !== modelName) {
    model = null
  }

  if (!model) {
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured')
    }
    genAI = new GoogleGenerativeAI(config.geminiApiKey)
    model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: LLM_DEFAULTS.maxOutputTokens
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }
      ]
    })
    currentModel = modelName
    console.log(`[LLM] Initialized Gemini provider with model: ${modelName}`)
  }
  return model
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), ms)
    )
  ])
}

export const GeminiProvider: LLMProvider = {
  async generate(prompt: string, timeoutMs: number = LLM_DEFAULTS.timeoutMs): Promise<string> {
    const client = getClient()
    const result = await withTimeout(
      client.generateContent(prompt),
      timeoutMs
    )
    return result.response.text()
  }
}
