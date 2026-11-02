import type { Metadata } from "next"
import "./globals.css"
import { cn } from "@/lib/utils"
import { TooltipProvider } from "@/components/ui/tooltip"
// Offline-safe: system font stack (Google Fonts need network at build time).

export const metadata: Metadata = {
  title: "Kasuwa — buy now, or wait?",
  description:
    "Price-shock forecasts for Nigerian markets, turned into actions with naira on them.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("h-full", "antialiased", "font-sans")}>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
