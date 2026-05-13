"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import {
    Clipboard,
    ShieldCheck,
    FileWarning,
    Search,
    Hash,
    Fingerprint,
    Clock,
    ChevronRight,
    SearchX,
    Trash2,
    Eye,
    Image as ImageIcon,
    FileText,
    X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditEntry {
    caseId: string;
    timestamp: string;
    fileName: string;
    fileSize: number;
    chassis: string | null;
    registration: string | null;
    status: string;
    extractionMethod: string;
    invalidReason: string | null;
    resultHash: string;
    imagePreview?: string; // Base64 or URL
    imagePages?: string[];  // All rendered pages for multi-page PDFs
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditEntry[]>([]);
    const [filter, setFilter] = useState("");
    const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);
    const [previewLog, setPreviewLog] = useState<AuditEntry | null>(null);
    const [zoom, setZoom] = useState(100);
    const [isLoading, setIsLoading] = useState(true);
    const [previewPageIndex, setPreviewPageIndex] = useState(0);

    const loadLogs = () => {
        try {
            const data = localStorage.getItem('verentis_audit');
            if (data) {
                const parsed = JSON.parse(data);
                // Sort by timestamp descending
                setLogs(parsed.sort((a: any, b: any) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                ));
            }
        } catch (e) {
            console.error("Failed to load audit logs", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();
        // Monitor for updates
        window.addEventListener('storage', loadLogs);

        // Polling interval as fallback for the same-window updates
        const interval = setInterval(loadLogs, 2000);

        return () => {
            window.removeEventListener('storage', loadLogs);
            clearInterval(interval);
        };
    }, []);

    const filteredLogs = logs.filter(l =>
        l.fileName?.toLowerCase()?.includes(filter.toLowerCase()) ||
        l.chassis?.toLowerCase()?.includes(filter.toLowerCase()) ||
        l.registration?.toLowerCase()?.includes(filter.toLowerCase()) ||
        l.status?.toLowerCase()?.includes(filter.toLowerCase()) ||
        (l as any).ticketId?.toLowerCase()?.includes(filter.toLowerCase()) ||
        (l as any).category?.toLowerCase()?.includes(filter.toLowerCase())
    );

    const clearLogs = () => {
        if (window.confirm("Are you sure you want to clear the forensic audit trail? This action cannot be undone.")) {
            localStorage.removeItem('verentis_audit');
            setLogs([]);
        }
    };

    const isImage = (fileName: string) => {
        const ext = fileName.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '');
    };

    return (
        <div className="min-h-full bg-[#050810] text-[#e8ecf4] p-8 font-sans selection:bg-[#00c2cb] selection:text-[#0a0d14]">
            {/* Ambient Background Glows */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-[#00c2cb] opacity-[0.03] rounded-full blur-[120px]" />
                <div className="absolute bottom-[0%] right-[0%] w-[400px] h-[400px] bg-[#0088ff] opacity-[0.02] rounded-full blur-[100px]" />
            </div>

            <div className="max-w-[1400px] mx-auto relative z-10 space-y-8">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-[#1e2535]">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#00c2cb10] border border-[#00c2cb30] rounded-xl flex items-center justify-center">
                                <Clipboard className="w-5 h-5 text-[#00c2cb]" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black tracking-tighter uppercase text-white">Forensic Audit Trail</h1>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-2 h-2 rounded-full bg-[#00c853] animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#00c853]">Live Forensic Ledger Active</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a5568] group-focus-within:text-[#00c2cb] transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by VIN, Plate, or Filename..."
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                                className="pl-11 pr-6 py-3 bg-[#10131c] border border-[#1e2535] rounded-full text-sm focus:outline-none focus:border-[#00c2cb] focus:ring-1 focus:ring-[#00c2cb30] w-[350px] transition-all placeholder:text-[#2d3748]"
                            />
                        </div>
                        <button
                            onClick={clearLogs}
                            className="p-3 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 transition-all hover:scale-105 active:scale-95 group"
                            title="Clear Audit Trail"
                        >
                            <Trash2 className="w-5 h-5 group-hover:animate-shake" />
                        </button>
                    </div>
                </div>

                {/* Audit Grid/Table */}
                <div className="bg-[#10131c]/50 backdrop-blur-md border border-[#1e2535] rounded-3xl overflow-hidden shadow-2xl relative">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-[#0a0d14]/80 border-b border-[#1e2535]">
                                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-[#4a5568]">Investigation Hub</th>
                                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-[#4a5568]">Extracted Metadata</th>
                                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-[#4a5568]">Forensic Verdict</th>
                                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-[#4a5568]">Chain of Custody</th>
                                    <th className="px-6 py-5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-[#4a5568]">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1e2535]/50">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-12 h-12 border-4 border-[#00c2cb10] border-t-[#00c2cb] rounded-full animate-spin" />
                                                <span className="text-xs font-black uppercase tracking-widest text-[#4a5568]">Accessing Vault...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-32 text-center">
                                            <div className="flex flex-col items-center gap-4 opacity-30">
                                                <SearchX className="w-16 h-16" />
                                                <div className="space-y-1">
                                                    <p className="text-sm font-black uppercase tracking-[0.1em]">No records in current scope</p>
                                                    <p className="text-xs font-medium">Clear filters or run a new forensic analysis to populate ledger</p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map((log, idx) => (
                                        <motion.tr
                                            key={log.timestamp + idx}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.03 }}
                                            className="group hover:bg-[#1e253520] transition-colors"
                                        >
                                            {/* Timestamp & File */}
                                            <td className="px-6 py-6">
                                                <div className="flex gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-[#1e2535] flex items-center justify-center shrink-0 border border-white/5 group-hover:border-[#00c2cb40] transition-colors">
                                                        <Clock className="w-4 h-4 text-[#4a5568] group-hover:text-[#00c2cb]" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-black tracking-tight text-[#e8ecf4] truncate max-w-[200px]">{log.fileName}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] font-bold text-[#4a5568] uppercase truncate">{new Date(log.timestamp).toLocaleString()}</span>
                                                            <span className="w-1 h-1 rounded-full bg-[#1e2535]" />
                                                            <span className="text-[10px] font-bold text-[#4a5568] uppercase">{log.caseId.slice(0, 12)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Metadata */}
                                            <td className="px-6 py-6">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 rounded bg-white/5 text-[#4a5568]">
                                                            <Fingerprint className="w-3 h-3" />
                                                        </div>
                                                        <span className="text-[11px] font-mono tracking-wider font-bold text-[#c8d0e0]">
                                                            {log.chassis || "MISSING_CHAS"}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 rounded bg-white/5 text-[#4a5568]">
                                                            <Hash className="w-3 h-3" />
                                                        </div>
                                                        <span className="text-[11px] font-mono tracking-wider font-bold text-[#c8d0e0]">
                                                            {log.registration || "MISSING_REG"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Verdict */}
                                            <td className="px-6 py-6">
                                                <div className={cn(
                                                    "inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest",
                                                    log.status === 'valid' ? "bg-[#00c85310] border-[#00c85330] text-[#00c853]" :
                                                        log.status === 'partial' ? "bg-[#ffab0010] border-[#ffab0030] text-[#ffab00]" :
                                                            "bg-[#ff174410] border-[#ff174430] text-[#ff1744]"
                                                )}>
                                                    {log.status === 'valid' && <ShieldCheck className="w-3 h-3" />}
                                                    {log.status !== 'valid' && <FileWarning className="w-3 h-3 text-[#ff1744]" />}
                                                    {log.status}
                                                </div>
                                                {log.invalidReason && (
                                                    <p className="text-[9px] text-[#4a5568] mt-2 italic font-medium max-w-[200px] leading-relaxed truncate">
                                                        {log.invalidReason}
                                                    </p>
                                                )}
                                            </td>

                                            {/* Evidence Hash */}
                                            <td className="px-6 py-6 font-mono text-[9px] text-[#2d3748] tracking-tighter">
                                                <div className="flex items-center gap-2 text-[#4a5568] mb-1">
                                                    <Hash className="w-3 h-3" />
                                                    <span className="font-sans font-black uppercase text-[8px] tracking-[0.2em]">Hash Integrity</span>
                                                </div>
                                                {log.resultHash}
                                            </td>

                                            {/* Details Button */}
                                            <td className="px-6 py-6 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setSelectedLog(log)}
                                                        className="w-8 h-8 rounded-lg bg-[#1e2535] hover:bg-[#00c2cb] border border-white/5 flex items-center justify-center transition-all group/btn"
                                                        title="View Evidence Details"
                                                    >
                                                        <Eye className="w-4 h-4 text-[#4a5568] group-hover/btn:text-[#0a0d14] transition-colors" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setZoom(100);
                                                            setPreviewLog(log);
                                                        }}
                                                        className="w-8 h-8 rounded-lg bg-[#1e2535] hover:bg-[#00c2cb] border border-white/5 flex items-center justify-center transition-all group/btn"
                                                        title="Preview Document"
                                                    >
                                                        <FileText className="w-4 h-4 text-[#4a5568] group-hover/btn:text-[#0a0d14] transition-colors" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Evidence Modal */}
            <AnimatePresence>
                {selectedLog && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-24 overflow-hidden">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedLog(null)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="w-full max-w-[700px] bg-[#10131c] border border-[#1e2535] rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,0.8)] relative z-10 overflow-hidden flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="px-8 py-6 border-b border-[#1e2535] bg-[#0a0d14] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Fingerprint className="w-6 h-6 text-[#00c2cb]" />
                                    <div>
                                        <h2 className="text-xl font-black tracking-tight text-white uppercase">Forensic Evidence Profile</h2>
                                        <p className="text-[10px] font-bold text-[#4a5568] uppercase tracking-[0.2em]">{selectedLog.caseId}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedLog(null)} className="w-8 h-8 rounded-full hover:bg-white/5 text-[#4a5568] hover:text-[#e8ecf4] transition-all flex items-center justify-center">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="px-8 py-8 flex-1 overflow-y-auto space-y-8">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-black text-[#4a5568] uppercase tracking-widest">Filename</p>
                                        <p className="text-sm font-bold text-[#e8ecf4] break-all">{selectedLog.fileName}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-black text-[#4a5568] uppercase tracking-widest">Timestamp</p>
                                        <p className="text-sm font-bold text-[#e8ecf4]">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-black text-[#4a5568] uppercase tracking-widest">Metadata Hash</p>
                                        <p className="text-[10px] font-mono text-[#00c2cb] break-all">{selectedLog.resultHash}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-black text-[#4a5568] uppercase tracking-widest">Extraction Agent</p>
                                        <p className="text-sm font-bold text-[#e8ecf4]">{selectedLog.extractionMethod}</p>
                                    </div>
                                </div>

                                <div className="p-6 bg-black/50 border border-[#1e2535] rounded-2xl flex items-center justify-between">
                                    <div className="space-y-4 flex-1">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-[#1e2535] flex items-center justify-center text-[#4a5568]">
                                                <Fingerprint className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-[#4a5568] uppercase tracking-widest">Chassis VIN</p>
                                                <p className="text-lg font-mono font-black text-white tracking-widest">{selectedLog.chassis || "NOT_DETECTED"}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-[#1e2535] flex items-center justify-center text-[#4a5568]">
                                                <Hash className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-[#4a5568] uppercase tracking-widest">Registration Plate</p>
                                                <p className="text-lg font-mono font-black text-white tracking-widest">{selectedLog.registration || "NOT_DETECTED"}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={cn(
                                        "w-32 h-32 rounded-3xl flex flex-col items-center justify-center gap-2 border shadow-2xl shrink-0",
                                        selectedLog.status === 'valid' ? "bg-[#00c85305] border-[#00c85330] text-[#00c853]" : "bg-[#ff174405] border-[#ff174430] text-[#ff1744]"
                                    )}>
                                        {selectedLog.status === 'valid' ? <ShieldCheck className="w-8 h-8" /> : <FileWarning className="w-8 h-8" />}
                                        <span className="text-[11px] font-black uppercase tracking-widest">{selectedLog.status}</span>
                                    </div>
                                </div>

                                {selectedLog.invalidReason && (
                                    <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl space-y-2">
                                        <div className="flex items-center gap-2 text-red-500">
                                            <FileWarning className="w-4 h-4" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Forensic Discrepancy Found</span>
                                        </div>
                                        <p className="text-xs font-medium text-[#c8d0e0] italic leading-relaxed">
                                            "{selectedLog.invalidReason}"
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="px-8 py-6 bg-[#0a0d14] border-t border-[#1e2535] flex justify-end">
                                <button
                                    onClick={() => setSelectedLog(null)}
                                    className="px-6 py-2 bg-[#1e2535] hover:bg-[#2d3748] border border-white/5 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                                >
                                    Close Intelligence Profile
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Preview Modal */}
            <AnimatePresence>
                {previewLog && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-hidden">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setPreviewLog(null)}
                            className="absolute inset-0 bg-black/95 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="w-[75vw] h-[90vh] bg-[#0a0d14] border border-[#1e2535] rounded-3xl shadow-[0_50px_100px_rgba(0,0,0,0.9)] relative z-20 overflow-hidden flex flex-col"
                        >
                            {/* Header */}
                            <div className="px-8 py-5 border-b border-[#1e2535] bg-[#0a0d14] flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-[#00c2cb10] text-[#00c2cb] flex items-center justify-center border border-[#00c2cb20]">
                                        {isImage(previewLog.fileName) ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-white uppercase tracking-tight leading-none">{previewLog.fileName}</h3>
                                        <p className="text-[10px] font-bold text-[#4a5568] uppercase tracking-[0.2em] mt-1.5">
                                            Forensic Capture: {new Date(previewLog.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setPreviewLog(null)}
                                    className="w-10 h-10 rounded-full hover:bg-white/5 text-[#4a5568] hover:text-white transition-all flex items-center justify-center border border-transparent hover:border-[#1e2535]"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Preview Area */}
                            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[#0a0d14] relative group/preview scrollbar-hide">
                                {/* Background Watermark */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none">
                                    <ShieldCheck className="w-96 h-96" />
                                </div>

                                {(previewLog.imagePreview || (previewLog.imagePages && previewLog.imagePages.length > 0)) ? (
                                    (() => {
                                        const pages = previewLog.imagePages || (previewLog.imagePreview ? [previewLog.imagePreview] : []);
                                        const src = pages[previewPageIndex] || previewLog.imagePreview || '';
                                        return (
                                            <div
                                                className="relative flex flex-col items-center justify-center gap-3 transition-all duration-200 ease-out"
                                                style={{
                                                    width: `${zoom}%`,
                                                    height: `${zoom}%`,
                                                    minWidth: '100%',
                                                    minHeight: '100%'
                                                }}
                                            >
                                                <img
                                                    src={src}
                                                    alt={previewLog.fileName}
                                                    className="object-contain shadow-2xl rounded-sm max-h-[65vh]"
                                                    style={{
                                                        width: '100%',
                                                        height: 'auto',
                                                        imageRendering: 'high-quality',
                                                        WebkitImageRendering: 'high-quality'
                                                    } as any}
                                                />
                                                {pages.length > 1 && (
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <button
                                                            onClick={() => setPreviewPageIndex(p => Math.max(0, p - 1))}
                                                            disabled={previewPageIndex === 0}
                                                            className={`px-3 py-1 rounded-lg text-xs font-black border transition-all ${previewPageIndex === 0
                                                                    ? 'bg-[#1e2535] text-[#4a5568] border-[#1e2535] cursor-default'
                                                                    : 'bg-[#00c2cb] text-[#0a0d14] border-[#00c2cb] hover:bg-[#00d4de] cursor-pointer'
                                                                }`}
                                                        >← Prev</button>
                                                        <span className="text-[11px] font-bold text-[#4a5568]">
                                                            Page {previewPageIndex + 1} of {pages.length}
                                                        </span>
                                                        <button
                                                            onClick={() => setPreviewPageIndex(p => Math.min(pages.length - 1, p + 1))}
                                                            disabled={previewPageIndex === pages.length - 1}
                                                            className={`px-3 py-1 rounded-lg text-xs font-black border transition-all ${previewPageIndex === pages.length - 1
                                                                    ? 'bg-[#1e2535] text-[#4a5568] border-[#1e2535] cursor-default'
                                                                    : 'bg-[#00c2cb] text-[#0a0d14] border-[#00c2cb] hover:bg-[#00d4de] cursor-pointer'
                                                                }`}
                                                        >Next →</button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <div className="flex flex-col items-center gap-8 py-20">
                                        <div className="w-40 h-40 rounded-[2rem] bg-[#1e2535] flex items-center justify-center shadow-2xl opacity-50">
                                            {isImage(previewLog.fileName) ? <ImageIcon className="w-20 h-20 text-[#4a5568]" /> : <FileText className="w-20 h-20 text-[#4a5568]" />}
                                        </div>
                                        <div className="text-center space-y-3 opacity-50">
                                            <p className="text-2xl font-black text-white uppercase tracking-tighter">Evidence Not Found</p>
                                            <p className="text-sm font-bold text-[#4a5568] uppercase tracking-widest max-w-md mx-auto">This historical entry does not contain a persistent visual capture.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Zoom Controls */}
                            <div className="px-8 py-4 bg-[#0a0d14] border-t border-[#1e2535] flex items-center justify-center shrink-0">
                                <div className="flex items-center gap-6 bg-[#10131c] px-6 py-2 rounded-full border border-[#1e2535] shadow-xl">
                                    <button
                                        onClick={() => setZoom(z => Math.max(50, z - 25))}
                                        className="w-8 h-8 rounded-full bg-[#1e2535] hover:bg-[#00c2cb] text-[#4a5568] hover:text-[#0a0d14] flex items-center justify-center transition-all font-black text-lg"
                                    >
                                        -
                                    </button>
                                    <div className="flex flex-col items-center min-w-[60px]">
                                        <span className="text-xs font-black text-[#e8ecf4] uppercase tracking-widest">{zoom}%</span>
                                    </div>
                                    <button
                                        onClick={() => setZoom(z => Math.min(300, z + 25))}
                                        className="w-8 h-8 rounded-full bg-[#1e2535] hover:bg-[#00c2cb] text-[#4a5568] hover:text-[#0a0d14] flex items-center justify-center transition-all font-black text-lg"
                                    >
                                        +
                                    </button>
                                    <div className="w-px h-4 bg-[#1e2535] mx-2" />
                                    <button
                                        onClick={() => setZoom(100)}
                                        className="text-[10px] font-black uppercase tracking-widest text-[#4a5568] hover:text-[#00c2cb] transition-colors"
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-2px); }
                    75% { transform: translateX(2px); }
                }
                .animate-shake {
                    animation: shake 0.2s ease-in-out infinite;
                }
            ` }} />
        </div>
    );
}
