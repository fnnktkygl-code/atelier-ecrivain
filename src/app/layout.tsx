import type { Metadata } from "next";
import ThemeProvider from "@/components/Shared/ThemeProvider";
import Navbar from "@/components/Shared/Navbar";
import AuthProvider from "@/components/Auth/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "L'Atelier de l'Écrivain",
  description:
    "Atelier d'écriture numérique avec dictée vocale intelligente, structuration IA et liseuse intégrée.",
  keywords: ["écrivain", "manuscrit", "liseuse", "dictée", "IA", "Gemini"],
  authors: [{ name: "Richard" }],
  openGraph: {
    title: "L'Atelier de l'Écrivain",
    description:
      "Dictez votre manuscrit, l'IA transcrit, structure, et vérifie vos citations.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,600;1,8..60,700&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,400;1,600&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <div className="app-layout">
              <Navbar />
              {children}
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
