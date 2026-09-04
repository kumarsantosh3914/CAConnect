import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0F172A' },
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
