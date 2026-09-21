import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fliproom — one room, many possibilities',
  description: 'A visual room changeover planner. Turn structured layouts into a practical, ordered move list.',
  robots: {index: false, follow: false},
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
