import type { Metadata } from 'next';
import { Outfit, JetBrains_Mono } from 'next/font/google';
import { SettingsProvider } from '@/context/SettingsContext';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kyo – Local Sound Cognition',
  description:
    'Browser-native semantic audio interpretation.',
  keywords: ['Kyo', 'local processing', 'Semantic analysis'],
  openGraph: {
    title: 'Kyo',
    description: 'Local audio cognition.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <body>
        <SettingsProvider>{children}</SettingsProvider>
      </body>
    </html>
  );
}
