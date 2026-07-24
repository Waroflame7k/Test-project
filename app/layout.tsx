import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import { FirebaseAnalytics } from "@/components/firebase-analytics";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "Hồ Sơ BĐS - Nguyễn Khoa BĐS",
  description: "Ứng dụng quản lý hồ sơ pháp lý bất động sản với giao diện tinh gọn, sang trọng cho Nguyễn Khoa BĐS.",
  applicationName: "Hồ Sơ BĐS",
  appleWebApp: {
    capable: true,
    title: "Hồ Sơ BĐS",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f1e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className="antialiased">
        {children}
        <FirebaseAnalytics />
        <PwaRegister />
      </body>
    </html>
  );
}
