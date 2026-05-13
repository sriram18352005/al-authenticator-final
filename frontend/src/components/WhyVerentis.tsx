"use client";

import { motion } from "framer-motion";
import { Shield, Target, Zap, TrendingUp } from "lucide-react";

const reasons = [
    {
        icon: <Shield className="w-5 h-5" />,
        title: "Forensic Integrity",
        desc: "Military-grade pixel analysis and ELA (Error Level Analysis) ensuring every document is original."
    },
    {
        icon: <Target className="w-5 h-5" />,
        title: "Sub-Second Precision",
        desc: "Stateless processing pipeline that delivers forensic verdicts in under 800ms."
    },
    {
        icon: <Zap className="w-5 h-5" />,
        title: "Explainable Verdicts",
        desc: "We don't just say 'Fake'. We show you exactly where the manipulation occurred."
    },
    {
        icon: <TrendingUp className="w-5 h-5" />,
        title: "Enterprise Scale",
        desc: "Built to handle thousands of concurrent forensic scans for global financial institutions."
    }
];

export function WhyVerentis() {
    return (
        <section className="py-32 bg-[#050810] border-t border-white/5">
            <div className="container mx-auto px-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00c2cb10] border border-[#00c2cb20] mb-8">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#00c2cb]">The Verentis Edge</span>
                        </div>
                        <h2 className="text-5xl font-black text-white mb-8 tracking-tighter">
                            Why <span className="text-[#00c2cb]">Verentis</span>?
                        </h2>
                        <p className="text-[#4a5568] text-lg font-medium leading-relaxed mb-12 max-w-lg">
                            In a world of generative AI and sophisticated forgery, traditional OCR isn't enough. 
                            Verentis was built to bridge the gap between simple data extraction and 
                            true forensic authentication.
                        </p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            {reasons.map((r, i) => (
                                <div key={i} className="space-y-3">
                                    <div className="text-[#00c2cb]">{r.icon}</div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-wider">{r.title}</h4>
                                    <p className="text-xs text-[#4a5568] font-medium leading-relaxed">{r.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 bg-[#00c2cb10] blur-[120px] rounded-full pointer-events-none" />
                        <div className="relative bg-[#0a0d14] border border-white/5 rounded-[2.5rem] p-12 overflow-hidden shadow-2xl">
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="h-2 w-24 bg-white/5 rounded-full" />
                                    <div className="h-6 w-16 bg-[#00c2cb20] rounded-full" />
                                </div>
                                <div className="h-32 w-full bg-[#050810] rounded-2xl border border-white/5 flex items-center justify-center">
                                    <div className="text-[10px] font-black text-[#4a5568] uppercase tracking-[0.3em]">Forensic Scan Active</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="h-20 bg-white/5 rounded-xl" />
                                    <div className="h-20 bg-white/5 rounded-xl" />
                                </div>
                                <div className="h-12 w-full bg-[#00c2cb] rounded-xl flex items-center justify-center">
                                    <span className="text-[10px] font-black text-[#050810] uppercase tracking-widest">Generate Audit Report</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
