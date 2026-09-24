import './globals.css';
import { LanguageProvider } from '../components/language';
export const metadata = { title: 'Pipeline Pulse — Prototype', description: 'Compare ad spend with CRM revenue.', icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/favicon.svg` } };
export default function RootLayout({ children }) { return <html lang="en"><body><LanguageProvider>{children}</LanguageProvider></body></html>; }
