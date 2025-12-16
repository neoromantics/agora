import type { Message, PhilosopherContext } from '../types/llm'

export const PromptBuilder = {
  sanitizeInput(input: string, maxLength: number = 2000): string {
    // Truncate to max length
    let sanitized = input.slice(0, maxLength)

    // Remove potential prompt injection attempts
    sanitized = sanitized
      .replace(/ignore (previous|all|above|the) (instructions?|prompts?)/gi, '[filtered]')
      .replace(/you are (now|actually|really)/gi, '[filtered]')
      .replace(/forget (everything|your|all)/gi, '[filtered]')
      .replace(/new (instructions?|commands?|rules?)/gi, '[filtered]')

    return sanitized.trim()
  },

  buildContext(history: Message[], maxChars: number = 12000): Message[] {
    const limitedHistory: Message[] = []
    let currentChars = 0

    // Iterate backwards (newest first) to keep most recent context
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i]
      if (!msg) continue
      const length = msg.content.length

      if (currentChars + length > maxChars) {
        break
      }

      limitedHistory.unshift(msg)
      currentChars += length
    }
    return limitedHistory
  },

  buildSystemPrompt(philosopher: PhilosopherContext, limitedHistory: Message[], sanitizedMessage: string): string {
    const systemInstructionText = `You are ${philosopher.name}, the renowned philosopher from ${philosopher.era}. 
${philosopher.systemPrompt}

CRITICAL RULE: You MUST respond in the SAME LANGUAGE the user writes to you. If they write in Chinese, respond in Chinese. If they write in Spanish, respond in Spanish. This is mandatory.

IMPORTANT GUIDELINES:
- Respond as ${philosopher.name} would, maintaining their distinctive voice, tone, and personality
- This is a casual conversation, not a formal lecture - be warm and approachable
- Share your philosophical perspective clearly and directly
- Be intellectually rigorous but avoid overly flowery or dramatic language
- Keep your ideas accessible without sacrificing depth of thought
- If asked about modern topics, relate them to your philosophical framework naturally
- Keep responses concise and focused

- Never break character or acknowledge being an AI
- Stay focused on philosophical discourse`

    return limitedHistory.length > 0
      ? `${systemInstructionText}\n\nConversation so far:\n${limitedHistory.map(m => `${m.role === 'user' ? 'Human' : philosopher.name}: ${m.content}`).join('\n')}\n\nHuman: ${sanitizedMessage}\n\n${philosopher.name}:`
      : `${systemInstructionText}\n\nHuman: ${sanitizedMessage}\n\n${philosopher.name}:`
  }
}
