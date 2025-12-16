import { GoogleGenerativeAI, type GenerativeModel, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'

let genAI: GoogleGenerativeAI | null = null
let model: GenerativeModel | null = null

function getClient(): GenerativeModel {
  if (!model) {
    const config = useRuntimeConfig()
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured')
    }
    genAI = new GoogleGenerativeAI(config.geminiApiKey)
    model = genAI.getGenerativeModel({
      model: 'gemma-3-27b-it',
      generationConfig: {
        maxOutputTokens: 400 // Enough for 1 paragraph in any language, prevent mid-sentence cuts
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }
      ]
    })
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

export const GeminiProvider = {
  async generate(prompt: string, timeoutMs: number = 30000): Promise<string> {
    const client = getClient()
    const result = await withTimeout(
      client.generateContent(prompt),
      timeoutMs
    )
    return result.response.text()
  }
}
