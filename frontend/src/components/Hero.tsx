"use client";

import { motion } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";

export function Hero() {
    return (
        <section className="relative pt-48 pb-32 overflow-hidden bg-[#050810]">
            {/* Subtle Forensic Gradients */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#00c2cb]/[0.03] to-transparent pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00c2cb] via-[#0088ff] to-[#00c2cb]" />

            <div className="container mx-auto px-12 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    {/* Left Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="flex items-center gap-2 mb-8">
                            <div className="w-2 h-2 rounded-full bg-[#00c2cb] animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00c2cb]">FORENSIC NODE V4.2 ACTIVE</span>
                        </div>
                        <h1 className="text-6xl md:text-7xl font-black text-white leading-[1.05] mb-8">
                            Verentis <br />
                            <span className="text-[#00c2cb]">Forensic</span> <br />
                            Intelligence <br />
                            Platform
                        </h1>
                        <p className="text-[#4a5568] text-lg max-w-lg mb-12 leading-relaxed font-medium">
                            Experience the precision of laboratory-grade document analysis.
                            Our Axiom-driven engine delivers immutable forensic clarity for
                            global financial ecosystems.
                        </p>

                        <div className="flex items-center gap-6">
                            <Link
                                href="/login"
                                className="px-10 py-5 bg-[#00c2cb] text-[#050810] rounded-md font-black text-xs tracking-widest hover:bg-[#00e6f0] transition-all shadow-2xl shadow-[#00c2cb]/20 uppercase flex items-center gap-3"
                            >
                                Start Forensic Audit
                            </Link>
                            <button className="flex items-center gap-2 text-xs font-black tracking-widest text-[#00c2cb] hover:text-[#00e6f0] transition-colors uppercase">
                                FSYN Framework <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>

                    {/* Right Visual Group */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="relative"
                    >
                        {/* Mockup Frame */}
                        <div className="relative z-10 bg-[#0a0d14] rounded-3xl p-8 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] border border-white/5 overflow-hidden">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-[#00c2cb10] flex items-center justify-center border border-[#00c2cb20]">
                                    <div className="w-3 h-3 rounded-sm border-2 border-[#00c2cb40]" />
                                </div>
                            </div>

                            <div className="space-y-4 mb-20 opacity-20">
                                <div className="h-0.5 w-full bg-[#00c2cb40]" />
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="h-24 bg-white/5 rounded-xl" />
                                    <div className="h-24 bg-white/5 rounded-xl" />
                                    <div className="h-24 bg-white/5 rounded-xl" />
                                </div>
                            </div>

                            {/* Score Overlay */}
                            <div className="absolute bottom-10 right-10 bg-[#050810] p-6 rounded-2xl shadow-2xl border border-white/10 backdrop-blur-md">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#00c2cb] mb-1 leading-none">Authenticity Index</p>
                                <h3 className="text-4xl font-black text-white tabular-nums">99.982%</h3>
                            </div>

                            {/* Scanning Animation */}
                            <motion.div
                                animate={{ y: [0, 400] }}
                                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                                className="absolute top-0 left-0 right-0 h-0.5 bg-[#00c2cb]/30 z-20"
                            >
                                <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-[#00c2cb]/10 to-transparent" />
                            </motion.div>
                        </div>

                        {/* Background Accents */}
                        <div className="absolute -top-10 -right-10 w-96 h-96 bg-[#00c2cb]/[0.03] rounded-full blur-[100px] pointer-events-none -z-10" />
                        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#0088ff]/[0.02] rounded-full blur-[80px] pointer-events-none -z-10" />
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
