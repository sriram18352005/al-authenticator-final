"use client";

import Link from "next/link";
import { ShieldCheck, Menu, User } from "lucide-react";
import { motion } from "framer-motion";

export function Navbar() {
    return (
        <motion.nav
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-12 py-5 bg-[#050810]/80 backdrop-blur-md border-b border-white/10"
        >
            <div className="flex items-center gap-2">
                <div className="bg-[#00c2cb] p-1.5 rounded-lg shadow-lg shadow-[#00c2cb]/30">
                    <ShieldCheck className="w-6 h-6 text-[#050810]" />
                </div>
                <span className="text-xl font-black tracking-tight text-white uppercase">
                    Verentis
                </span>
            </div>

            <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#4a5568]">
                <Link href="#solutions" className="hover:text-[#00c2cb] transition-colors">Solutions</Link>
                <Link href="#explainability" className="hover:text-[#00c2cb] transition-colors">Explainability</Link>
                <Link href="#compliance" className="hover:text-[#00c2cb] transition-colors">Compliance</Link>
                <Link href="#pricing" className="hover:text-[#00c2cb] transition-colors">Pricing</Link>
            </div>

            <div className="flex items-center gap-6">
                <Link href="/login" className="text-sm font-semibold text-[#4a5568] hover:text-[#00c2cb] transition-colors">
                    Client Login
                </Link>
                <Link
                    href="/login"
                    className="px-6 py-2.5 text-sm font-bold text-[#050810] bg-[#00c2cb] rounded-md hover:bg-[#00e6f0] transition-all shadow-lg shadow-[#00c2cb]/20"
                >
                    ENTERPRISE ACCESS
                </Link>
                <Menu className="w-6 h-6 md:hidden text-white cursor-pointer" />
            </div>
        </motion.nav>
    );
}
