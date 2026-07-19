import type { Metadata } from "next";
import ThemeProvider from "@/components/Shared/ThemeProvider";
import Navbar from "@/components/Shared/Navbar";
import AuthProvider from "@/components/Auth/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atelier d'Écrivain — Les dieux à l'image des hommes",
  description:
    "Atelier d'écriture numérique avec dictée vocale intelligente, structuration IA et liseuse intégrée.",
  keywords: ["écrivain", "manuscrit", "liseuse", "dictée", "IA", "Gemini"],
  authors: [{ name: "Richard" }],
  openGraph: {
    title: "Atelier d'Écrivain — Les dieux à l'image des hommes",
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
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=Cormorant+Garamond:wght@500;600&display=swap"
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
