import './globals.css'
import Script from 'next/script'

export const metadata = {
  title: 'POI Mapping Platform',
  description: 'Research team POI mapping and harvesting platform',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=maps`}
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
