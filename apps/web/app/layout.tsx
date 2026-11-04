import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "SMARTDERIVBOT | Synthetic Indices Terminal", description: "Deriv synthetic indices analytics and trading console." };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }