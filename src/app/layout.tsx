import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'V ayigh | Intelligent HUD',
  description: 'AI-Powered Command Center and Integrated Terminal',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Source+Code+Pro:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased selection:bg-primary selection:text-primary-foreground overflow-hidden h-screen w-screen">
        <div className="scanline"></div>
        {children}
      </body>
    </html>
  );
}
