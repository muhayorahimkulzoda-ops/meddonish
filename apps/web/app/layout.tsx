import type { Metadata, Viewport } from 'next';
import { translate } from '@meddonish/localization';
import { OnboardingGate } from '../components/OnboardingGate';
import './globals.css';

export const metadata: Metadata = {
  title: 'MEDdonish',
  description: translate('tg', 'home.hero.subtitle'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tg">
      <body>
        <OnboardingGate>{children}</OnboardingGate>
      </body>
    </html>
  );
}
