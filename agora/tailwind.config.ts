import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'
import colors from 'tailwindcss/colors'

export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        primary: colors.slate,
        gray: colors.stone,
        neutral: colors.stone
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['Inter', ...defaultTheme.fontFamily.sans]
      }
    }
  }
}
