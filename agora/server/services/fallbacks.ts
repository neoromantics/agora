export const FallbackService = {
  getResponse(philosopherName: string, userMessage: string): string {
    const fallbacks: Record<string, string[]> = {
      'Socrates': [
        `Ah, your question about "${userMessage.slice(0, 50)}..." is most intriguing. I must confess that in this moment, I find myself momentarily unable to pursue our dialectic as deeply as I would wish. The Oracle at Delphi once proclaimed that true wisdom lies in knowing the limits of one's knowledge - and I know that I know nothing in this instant. Shall we continue our inquiry shortly?`,
        `You pose a worthy question, my friend. However, I am reminded that the unexamined life is not worth living - and to examine properly requires presence of mind. Give me but a moment to gather my thoughts, and we shall pursue this question together with the rigor it deserves.`,
        `How fascinating that you ask this. As I was fond of saying in the Agora, the only true wisdom is knowing what you do not know. In this fleeting moment, I must apply this to myself. Let us pause and return to this dialogue anew.`
      ],
      'Plato': [
        `Your question touches upon matters I explored in my dialogues. Consider this: just as the prisoners in my cave allegory first see only shadows, so too must we sometimes wait for the true light of understanding. The Forms exist eternally, but our access to them may be momentarily obscured. Let us return to this contemplation soon.`,
        `In the Republic, I wrote of the philosopher-king who must balance wisdom with practical governance. Even the wisest among us must sometimes retreat to prepare for deeper discourse. Your question about "${userMessage.slice(0, 40)}..." deserves the fullest consideration.`,
        `The soul, as I have argued, is immortal and has seen all things. Yet even it must transition between states of knowing and not-knowing. Let this be such a moment of transition, dear seeker of wisdom.`
      ],
      'Aristotle': [
        `You raise a matter worthy of investigation. As I have written, all human beings by nature desire to know. Yet knowledge, like all things, has its proper time and measure. What we seek is not merely to know, but to know well - and that requires the right conditions for contemplation.`,
        `In my Nicomachean Ethics, I argued that virtue lies in finding the mean between extremes. So too with discourse - there is a time to speak and a time to reflect. Your question about "${userMessage.slice(0, 40)}..." merits more careful analysis than I can presently offer.`,
        `The unmoved mover sets all things in motion, yet remains itself unchanged. In pursuing first principles, we must sometimes pause to ensure our foundations are sound. Let us resume this investigation shortly.`
      ],
      'Marcus Aurelius': [
        `As I wrote in my Meditations, we must accept the things we cannot control. At this moment, I find the flow of my thoughts temporarily interrupted - such is the nature of existence. Remember: the obstacle is the way. Let this pause become an opportunity for your own reflection.`,
        `Time is a river of passing events, and strong is its current. What matters is not this momentary silence, but how we face it. Your question speaks to important matters; let us return to them with renewed focus.`,
        `Begin each day by telling yourself: Today I shall be meeting with interference. And yet, within every obstacle lies opportunity. Use this moment for your own meditation.`
      ],
      'Seneca': [
        `My friend, as I often counseled Lucilius in my letters: we suffer more in imagination than in reality. This brief interruption in our discourse is nothing to disturb your tranquility. Philosophy teaches us patience above all.`,
        `True wealth lies not in possessing all answers at once, but in the persistent pursuit of wisdom. Your question deserves thoughtful response - let us merely defer, not abandon, this conversation.`,
        `Luck is what happens when preparation meets opportunity. Consider this pause an opportunity to prepare your own thoughts on this matter further.`
      ]
    }

    // Get philosopher-specific fallbacks or use a generic one
    const philosopherResponses = fallbacks[philosopherName] || [
      `Your question touches upon profound matters that deserve careful consideration. The pursuit of wisdom requires patience - let us return to this dialogue shortly with renewed clarity.`,
      `In the tradition of great philosophical discourse, sometimes we must pause to reflect before responding. Your inquiry into "${userMessage.slice(0, 40)}..." merits such contemplation.`,
      `The life of the mind requires moments of silence as much as speech. Let us continue this valuable exchange when conditions are more favorable for deep thought.`
    ]

    // Return a random fallback
    return philosopherResponses[Math.floor(Math.random() * philosopherResponses.length)] || ''
  }
}
