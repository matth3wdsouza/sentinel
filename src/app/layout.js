import { Manrope, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import TopBar from "@/components/TopBar";
import DragGuard from "@/components/DragGuard";
import ScrollToTop from "@/components/ScrollToTop";
import CommandPalette from "@/components/CommandPalette";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-technical",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata = {
  title: "Sentinel",
  description: "A cybersecurity and privacy toolkit for everyday users.",
};

// Runs before paint to apply the stored theme class to <html>, avoiding a
// flash of the wrong theme. Stored values: "light", "dark", or "auto"
// (default). When "auto" or missing, follows the OS prefers-color-scheme.
const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('sentinel-theme');
    if (t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <DragGuard />
        <ScrollToTop />
        <CommandPalette />
        <TopBar />
        {children}
      </body>
    </html>
  );
}
