import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { Providers } from "@/components/shell/Providers";

export const metadata: Metadata = {
  title: "XMUM Compass",
  description: "One calm place for your timetable, deadlines, campus map, clubs, fees and a campus AI agent. Prototype with demo data.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f2f2f7" }, { media: "(prefers-color-scheme: dark)", color: "#07090f" }],
};

// Apply a saved theme before first paint to avoid a flash.
const themeScript = `try{var s=JSON.parse(localStorage.getItem("xmum-compass:v1")||"{}");if(s.theme&&s.theme!=="system")document.documentElement.setAttribute("data-theme",s.theme)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
