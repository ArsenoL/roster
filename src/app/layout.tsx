import type { Metadata } from "next";
import { Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { CommandPalette } from "@/components/clubhub/command-palette";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "Roster — club operations for high schools",
    template: "%s · Roster",
  },
  description:
    "Roster runs the day-to-day of a high school club: attendance, members, events, hours, finance, and reporting. In-house, no third-party trackers, FERPA/COPPA-aware.",
  keywords: [
    "club management",
    "high school",
    "attendance",
    "volunteer hours",
    "club finance",
    "student activities",
  ],
  authors: [{ name: "Roster" }],
  openGraph: {
    title: "Roster — club operations for high schools",
    description:
      "Attendance, members, events, hours, finance, and reporting for every club at your school.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline script prevents dark-mode flash by reading localStorage before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
          (function() {
            try {
              var stored = localStorage.getItem('roster.theme');
              var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              if (stored === 'dark' || (!stored && prefersDark)) {
                document.documentElement.classList.add('dark');
              }
            } catch (e) {}
          })();
        `,
          }}
        />
      </head>
      <body
        className={`${publicSans.variable} ${plexMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="bottom-right" />
        <CommandPalette />
      </body>
    </html>
  );
}
