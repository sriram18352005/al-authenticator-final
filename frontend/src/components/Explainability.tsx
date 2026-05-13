"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const certifications = [
    { label: "CERTIFIED", name: "ISO/IEC 27001" },
    { label: "COMPLIANCE", name: "SOC2 TYPE II" },
    { label: "REGULATORY", name: "GDPR / CCPA" },
    { label: "STANDARD", name: "HIPAA COMPLIANT" },
];

const metrics = [
    { label: "SPECTRAL", value: 35, height: "40%" },
    { label: "ELA", value: 55, height: "65%" },
    { label: "METADATA", value: 45, height: "52%" },
    { label: "BIOMETRIC", value: 90, height: "92%", active: true },
    { label: "CONFIDENCE", value: 65, height: "70%" },
    { label: "NEURAL", value: 40, height: "48%" },
];

export function Explainability() {
    return (
        <section id="explainability" className="bg-[#050810] py-32 border-y border-white/5">
            <div className="container mx-auto px-12">
                {/* Certification Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 mb-32 border-b border-white/10 pb-20">
                    {certifications.map((cert) => (
                        <div key={cert.name} className="flex gap-4 items-center">
                            <div className="p-2.5 bg-[#0a0d14] rounded-lg shadow-sm border border-white/5">
                                <CheckCircle2 className="w-5 h-5 text-[#00c2cb]" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-[#4a5568] uppercase tracking-widest">{cert.label}</p>
                                <p className="text-sm font-black text-white">{cert.name}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Explainability Content */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
                    {/* Chart Visualization */}
                    <div className="bg-[#0a0d14] rounded-[40px] p-12 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] border border-white/5 relative overflow-hidden group">
                        <div className="absolute top-8 right-12">
                            <motion.div
                                initial={{ scale: 0 }}
                                whileInView={{ scale: 1 }}
                                className="bg-[#00c2cb] text-[#050810] text-[12px] font-black px-4 py-2 rounded-full shadow-2xl"
                            >
                                98.8%
                            </motion.div>
                        </div>

                        <div className="flex items-end justify-between h-72 gap-6 px-4 mt-12">
                            {metrics.map((m) => (
                                <div key={m.label} className="flex-1 flex flex-col items-center gap-8">
                                    <div className="w-full relative group/bar flex-1 flex flex-col justify-end">
                                        <motion.div
                                            initial={{ height: 0 }}
                                            whileInView={{ height: m.height }}
                                            transition={{ duration: 1, delay: 0.2, ease: "circOut" }}
                                            className={`w-full rounded-2xl transition-all duration-500 ${m.active ? 'bg-[#00c2cb] shadow-[0_20px_40px_-5px_rgba(0,194,203,0.4)]' : 'bg-white/5 group-hover/bar:bg-white/10'
                                                }`}
                                        />
                                    </div>
                                    <span className="text-[10px] font-black text-[#4a5568] uppercase tracking-widest">{m.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Textual Description */}
                    <div className="space-y-10">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00c2cb10] border border-[#00c2cb20] mb-6">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#00c2cb]">Transparency</span>
                            </div>
                            <h2 className="text-4xl font-black text-white mb-6 leading-tight">
                                AI Explainability & <br />
                                <span className="text-[#00c2cb]">Confidence Metrics</span>
                            </h2>
                            <p className="text-[#4a5568] max-w-md leading-relaxed font-medium">
                                We don't just provide a 'pass/fail' result. Our platform delivers a
                                comprehensive confidence breakdown, visualizing the exact forensic layers
                                that contributed to the final score.
                            </p>
                        </div>

                        <div className="space-y-8">
                            {[
                                { title: "Layer-Specific Attribution", desc: "Identify exactly which security features were flagged during the automated forensic process." },
                                { title: "Probabilistic Forecasting", desc: "Understand the statistical likelihood of systemic fraud with high-fidelity intensity mapping." }
                            ].map((item) => (
                                <div key={item.title} className="flex gap-6 items-start group">
                                    <div className="mt-1 p-1 bg-[#00c2cb10] rounded-md border border-[#00c2cb20] group-hover:bg-[#00c2cb] group-hover:border-[#00c2cb] transition-all">
                                        <CheckCircle2 className="w-4 h-4 text-[#00c2cb] group-hover:text-[#050810] transition-colors" />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-black text-white mb-2">{item.title}</h4>
                                        <p className="text-sm text-[#4a5568] font-medium leading-relaxed max-w-sm">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
