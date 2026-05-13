"use client";

import React, { useState } from "react";
import { useForensicAnalysis } from "@/hooks/useForensicAnalysis";
import { DocumentUpload } from "./DocumentUpload";
import { PipelineStatus } from "./PipelineStatus";
import { AnalysisSidebar } from "./AnalysisSidebar";
import { DocumentPreview } from "./DocumentPreview";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, RefreshCw, Fingerprint, ScanLine, Cpu, CheckCircle2 } from "lucide-react";

export function IdentityModule() {
    const {
        isProcessing,
        currentStage,
        result,
        imageUrl,
        processDocument,
        reset
    } = useForensicAnalysis();

    const [isDragging, setIsDragging] = useState(false);

    const handleUpload = (file: File) => {
        processDocument(file, undefined, "identity");
    };

    const hasResult = !!result.verdict;

    return (
        <div className="space-y-6">
            <AnimatePresence mode="wait">
                {/* ── UPLOAD STATE ── */}
                {!hasResult && !isProcessing && (
                    <motion.div
                        key="upload"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="max-w-4xl mx-auto py-8"
                    >
                        {/* Hero Header */}
                        <div className="text-center mb-12">
                            <div className="relative inline-flex mb-8">
                                <div className="w-24 h-24 bg-[#00c2cb10] rounded-3xl flex items-center justify-center border border-[#00c2cb30] shadow-[0_0_40px_rgba(0,194,203,0.1)]">
                                    <Shield className="w-12 h-12 text-[#00c2cb]" />
                                </div>
                                {/* Orbiting ring */}
                                <div className="absolute inset-0 rounded-3xl border border-[#00c2cb20] animate-ping" style={{ animationDuration: '3s' }} />
                            </div>
                            <h1 className="text-4xl font-black uppercase tracking-tighter text-white mb-3">
                                Identity Verification
                            </h1>
                            <p className="text-[#4a5568] max-w-lg mx-auto font-medium leading-relaxed">
                                Multi-spectral forensic analysis, neural OCR extraction, and biometric tamper detection on government-issued IDs.
                            </p>

                            {/* Capability Pills */}
                            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                                {['PAN Card', 'Aadhaar', 'Passport', 'Driving License'].map(doc => (
                                    <span key={doc} className="px-3 py-1 bg-[#1e2535] border border-[#2d3748] rounded-full text-[10px] font-black uppercase tracking-widest text-[#c8d0e0]">
                                        {doc}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Upload Zone */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-b from-[#00c2cb05] to-transparent rounded-3xl pointer-events-none" />
                            <DocumentUpload
                                onFileSelect={handleUpload}
                                isProcessing={isProcessing}
                                activeBank="AUTO"
                            />
                        </div>

                        {/* Forensic Signal Strips */}
                        <div className="grid grid-cols-3 gap-4 mt-8">
                            {[
                                { icon: <ScanLine className="w-4 h-4" />, label: 'Neural OCR', desc: '99.4% extraction accuracy', color: '#00c2cb' },
                                { icon: <Fingerprint className="w-4 h-4" />, label: 'Biometric Check', desc: 'Photo & signature verification', color: '#0088ff' },
                                { icon: <Cpu className="w-4 h-4" />, label: 'Tamper Detection', desc: 'Multi-layer forgery analysis', color: '#ffab00' },
                            ].map(item => (
                                <div key={item.label} className="flex items-center gap-3 p-4 bg-[#10131c]/50 border border-[#1e2535] rounded-2xl">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: item.color + '15', color: item.color, border: `1px solid ${item.color}30` }}>
                                        {item.icon}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[#e8ecf4]">{item.label}</p>
                                        <p className="text-[9px] text-[#4a5568] font-medium">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ── PROCESSING STATE ── */}
                {isProcessing && (
                    <motion.div
                        key="processing"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="max-w-2xl mx-auto py-16 space-y-10"
                    >
                        {/* Animated Biometric Scan Visual */}
                        <div className="flex flex-col items-center gap-6">
                            <div className="relative w-32 h-32">
                                {/* Outer ring */}
                                <div className="absolute inset-0 rounded-full border-2 border-[#00c2cb20] animate-spin" style={{ animationDuration: '8s' }} />
                                {/* Middle ring */}
                                <div className="absolute inset-4 rounded-full border border-[#00c2cb40] animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }} />
                                {/* Inner core */}
                                <div className="absolute inset-8 rounded-full bg-[#00c2cb10] border border-[#00c2cb60] flex items-center justify-center shadow-[0_0_30px_rgba(0,194,203,0.3)]">
                                    <Fingerprint className="w-8 h-8 text-[#00c2cb] animate-pulse" />
                                </div>
                                {/* Scan beam */}
                                <div className="absolute inset-0 rounded-full overflow-hidden">
                                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00c2cb] to-transparent animate-bounce" style={{ animationDuration: '2s' }} />
                                </div>
                            </div>
                            <div className="text-center space-y-1">
                                <h3 className="text-xl font-black uppercase tracking-tight text-white">Biometric Analysis</h3>
                                <p className="text-[10px] text-[#4a5568] uppercase tracking-[0.3em] font-black">Neural scan in progress</p>
                            </div>
                        </div>

                        <PipelineStatus currentStage={currentStage} />

                        {/* Live Detail Steps */}
                        <div className="space-y-3">
                            {['Substrate Integrity', 'OCR Field Extraction', 'Biometric Fingerprint', 'Forgery Pattern Match'].map((step, i) => (
                                <div key={step} className="flex items-center gap-3 p-3 bg-[#10131c]/50 border border-[#1e2535] rounded-xl">
                                    <div className="w-5 h-5 rounded-full border border-[#00c2cb30] flex items-center justify-center shrink-0">
                                        <div className="w-2 h-2 rounded-full bg-[#00c2cb] animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#4a5568]">{step}</span>
                                    <RefreshCw className="w-3 h-3 text-[#00c2cb] ml-auto animate-spin" style={{ animationDuration: `${2 + i}s` }} />
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ── RESULT STATE ── */}
                {hasResult && !isProcessing && (
                    <motion.div
                        key="result"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-1 xl:grid-cols-12 gap-8"
                    >
                        {/* Left: Document Viewer */}
                        <div className="xl:col-span-8 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-[#00c2cb] animate-pulse" />
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-[#4a5568]">Original Substrate Scan</h3>
                                </div>
                                <button
                                    onClick={reset}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#1e2535] hover:bg-[#2d3748] border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#c8d0e0] transition-all"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    New Analysis
                                </button>
                            </div>

                            {/* Result verdict banner */}
                            <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border ${(result.verdict || '').toString().includes('VERIF') || (result.verdict || '').toString().includes('GENUINE')
                                    ? 'bg-[#00c85310] border-[#00c85330] text-[#00c853]'
                                    : 'bg-[#ff174410] border-[#ff174430] text-[#ff1744]'
                                }`}>
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-widest">Forensic Verdict: {result.verdict}</span>
                            </div>

                            <div className="sticky top-24">
                                <DocumentPreview
                                    imageUrl={imageUrl || ""}
                                    isScanning={isProcessing}
                                    isPdf={result.isPdf}
                                    pageUrls={result.viewUrls}
                                    verdict={result.verdict}
                                    scores={result.scores}
                                />
                            </div>
                        </div>

                        {/* Right: Forensic Intelligence */}
                        <div className="xl:col-span-4">
                            <AnalysisSidebar
                                result={result}
                                isProcessing={isProcessing}
                                documentType={result.documentType || "IDENTITY"}
                                analysisMode="identity"
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
