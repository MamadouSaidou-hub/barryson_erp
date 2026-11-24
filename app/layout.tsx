import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { companyInfo } from '@/lib/company-info'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: `${companyInfo.shortName} · ERP`,
  description: 'Gestion des achats, réceptions et stock de Group Barryson.',
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: '#f7f9fc',
  userScalable: true,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`bg-background ${inter.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
