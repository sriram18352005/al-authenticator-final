"use client";

import { motion } from "framer-motion";
import { Zap, Shield, Search, BarChart3, Fingerprint, Lock } from "lucide-react";

const features = [
    {
        icon: <Zap className="w-6 h-6 text-[#00c2cb]" />,
        title: "Real-Time Analysis",
        description: "Stateless processing pipeline delivering sub-second forensic insights without data persistence."
    },
    {
        icon: <Shield className="w-6 h-6 text-[#00c2cb]" />,
        title: "Pixel Integrity",
        description: "Multi-layered ELA and noise analysis detecting digital manipulation at the sub-pixel level."
    },
    {
        icon: <Search className="w-6 h-6 text-[#00c2cb]" />,
        title: "Structural Verification",
        description: "YOLO-driven symbol detection for official stamps, signatures, and holographic security elements."
    },
    {
        icon: <BarChart3 className="w-6 h-6 text-[#00c2cb]" />,
        title: "Explainable AI (XAI)",
        description: "Transparent scoring mechanisms providing clear rationale for every VERIFIED or FAKE verdict."
    },
    {
        icon: <Fingerprint className="w-6 h-6 text-[#00c2cb]" />,
        title: "ID Specialization",
        description: "Algorithmic validation for Aadhaar checksums, MRZ strings, and international passport zones."
    },
    {
        icon: <Lock className="w-6 h-6 text-[#00c2cb]" />,
        title: "Audit Grade",
        description: "Cryptographically-linked action logs and legally-auditable forensic PDF reporting."
    }
];

export function Features() {
    return (
        <section id="features" className="py-24 bg-[#050810]">
            <div className="container mx-auto px-12">
                <div className="text-center mb-24">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00c2cb10] border border-[#00c2cb20] mb-6">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#00c2cb]">System Capabilities</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">Enterprise-Ready Intelligence</h2>
                    <p className="text-[#4a5568] max-w-2xl mx-auto font-medium">
                        Engineered for high-stakes environments where accuracy and security are non-negotiable.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="p-10 rounded-[2rem] border border-white/5 bg-[#0a0d14] hover:bg-[#0d101a] hover:border-[#00c2cb30] transition-all group"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-[#00c2cb10] flex items-center justify-center mb-8 border border-[#00c2cb20] group-hover:scale-110 transition-transform">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4">{feature.title}</h3>
                            <p className="text-[#4a5568] text-sm leading-relaxed font-medium">{feature.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
