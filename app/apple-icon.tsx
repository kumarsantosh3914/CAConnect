import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/**
 * iOS home-screen icon. Generated rather than checked in as a binary, so it
 * stays in step with app/icon.svg. Apple ignores SVG here, hence next/og.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0F172A',
        }}
      >
        <svg width="112" height="112" viewBox="0 0 32 32">
          <path
            d="M10 7h8.5L23 11.5V25a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"
            fill="#FFFFFF"
          />
          <path d="M18.5 7 23 11.5h-4.5V7z" fill="#94A3B8" />
          <path
            d="m12.2 17.6 2.6 2.6 5-5.4"
            fill="none"
            stroke="#0F172A"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    size
  )
}
