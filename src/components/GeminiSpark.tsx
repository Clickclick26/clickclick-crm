/**
 * Marks the AI-lookup features as what they actually are — this stuff genuinely
 * runs on Gemini (see the "Gemini's memory" copy right next to every use of it),
 * so this is attribution for a real integration, not a borrowed logo. Simple
 * sparkle glyph in Gemini's actual brand gradient (blue → purple → orange), not
 * an attempt at reproducing Google's wordmark/lockup.
 */
export function GeminiSpark({ size = 14 }: { size?: number }) {
  const gradId = 'gemini-spark-grad'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      style={{ display: 'inline-block', verticalAlign: '-2px', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="16" y2="16">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="50%" stopColor="#9168C0" />
          <stop offset="100%" stopColor="#F59E42" />
        </linearGradient>
      </defs>
      <path
        d="M8 0C8 4.4 4.4 8 0 8C4.4 8 8 11.6 8 16C8 11.6 11.6 8 16 8C11.6 8 8 4.4 8 0Z"
        fill={`url(#${gradId})`}
      />
    </svg>
  )
}
