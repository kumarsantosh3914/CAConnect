import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Public_Sans, Source_Serif_4 } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

/*
 * The type is chosen from the subject, not from the framework.
 *
 * Public Sans was drawn for the US Web Design System — a face made for
 * government forms, which is what a CA reads all day. Source Serif carries the
 * institutional register of a statutory letter in headings without tipping into
 * the trendy display serifs. IBM Plex Mono has true tabular figures, and every
 * screen here is a column of rupees and due dates that has to line up.
 */
const bodyFont = Public_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
})
const displayFont = Source_Serif_4({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
})
const monoFont = IBM_Plex_Mono({
  variable: '--font-mono-figures',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F8F4' },
    { media: '(prefers-color-scheme: dark)', color: '#12161C' },
  ],
}

export const metadata: Metadata = {
  title: {
    default: 'CAConnect — Run your CA firm without the chaos',
    template: '%s · CAConnect',
  },
  description:
    'Practice management for small Indian CA firms. Track compliance deadlines, collect client documents, log fees, and draft IT notice responses with AI.',
  applicationName: 'CAConnect',
  openGraph: {
    title: 'CAConnect — Run your CA firm without the chaos',
    description:
      'Client deadlines, document collection, fee tracking and AI-drafted IT notice replies, built for Indian CA firms of one to five people.',
    siteName: 'CAConnect',
    locale: 'en_IN',
    type: 'website',
  },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
