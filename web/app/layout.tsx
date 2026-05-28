import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "SalaryMS",
	description: "Salary Management System",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body className={`${geist.className} bg-slate-50 antialiased`}>
				<Navbar />
				<main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
			</body>
		</html>
	);
}
