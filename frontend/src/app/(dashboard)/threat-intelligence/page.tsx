"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Activity,
    Shield,
    AlertTriangle,
    Clock,
    ArrowUpRight,
    Fingerprint,
    TrendingUp,
    Zap,
    Globe,
    FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FraudGauge, LiveTicker, Sparkline, DonutChart, ManufacturerBoard, VerificationTimeline, FraudCalendar, CountUpNumber } from "@/components/forensics/DashboardWidgets";

interface AnalyticsSession {
    id: number;
    date: string;
    total: number;
    valid: number;
    invalid: number;
    partial: number;
    skipped: number;
    manufacturers: Record<string, number>;
    states: Record<string, number>;
}

function safeDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

function safePct(num: number, den: number): number {
    if (!den || den === 0 || isNaN(den)) return 0;
    const result = Math.round((num / den) * 100);
    return isNaN(result) ? 0 : result;
}

function safeNum(n: any): number {
    const v = Number(n);
    return isNaN(v) ? 0 : v;
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY GRAPH — High-fidelity Area Chart
// ═══════════════════════════════════════════════════════════════
function ActivityGraph({ sessions }: { sessions: AnalyticsSession[] }) {
    const [hoveredData, setHoveredData] = useState<any | null>(null);

    // ── Build 14-day timeline ──────────────────────────────────────
    const today = new Date();
    const timeline: {
        date: Date;
        dateStr: string;
        label: string;
        total: number;
        valid: number;
        invalid: number;
    }[] = [];

    for (let i = 13; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        timeline.push({ date: d, dateStr, label, total: 0, valid: 0, invalid: 0 });
    }

    // Populate from sessions
    sessions.forEach(s => {
        const sd = safeDate(s.date);
        if (!sd) return;
        const sessionDate = sd.toISOString().split('T')[0];
        const point = timeline.find(p => p.dateStr === sessionDate);
        if (point) {
            point.total += safeNum(s.total);
            point.valid += safeNum(s.valid);
            point.invalid += safeNum(s.invalid);
        }
    });

    const maxVal = Math.max(...timeline.map(p => p.total), 10);
    const chartHeight = 200;
    const chartWidth = 1000;
    const padding = 40;

    const points = timeline.map((p, i) => {
        const x = (i / (timeline.length - 1)) * (chartWidth - padding * 2) + padding;
        const y = chartHeight - (p.total / maxVal) * (chartHeight - padding * 2) - padding;
        return { x, y, ...p };
    });

    const areaPath = `
        M ${points[0].x} ${chartHeight - padding}
        ${points.map(p => `L ${p.x} ${p.y}`).join(' ')}
        L ${points[points.length - 1].x} ${chartHeight - padding}
        Z
    `;

    const linePath = `
        M ${points[0].x} ${points[0].y}
        ${points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')}
    `;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#10131c]/50 backdrop-blur-md border border-[#1e2535] rounded-3xl p-8 space-y-6 relative overflow-hidden group"
        >
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#00c2cb 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
            </div>

            <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#00c2cb10] border border-[#00c2cb20] flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-[#00c2cb]" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Activity Intelligence</h3>
                        <p className="text-[10px] font-black text-[#4a5568] uppercase tracking-[0.2em] mt-1">Forensic investigation velocity (14-day window)</p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#00c2cb]" />
                        <span className="text-[10px] font-black text-[#4a5568] uppercase tracking-widest">Scan Volume</span>
                    </div>
                    <div className="px-4 py-2 bg-[#050810] border border-[#1e2535] rounded-xl">
                        <span className="text-xs font-black text-[#00c2cb]">{timeline.reduce((a, b) => a + b.total, 0)} TOTAL SCANS</span>
                    </div>
                </div>
            </div>

            <div className="relative h-[250px] w-full mt-8 select-none">
                <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full h-full overflow-visible"
                    preserveAspectRatio="none"
                >
                    <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#00c2cb" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#00c2cb" stopOpacity="0" />
                        </linearGradient>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>

                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map(v => (
                        <line
                            key={v}
                            x1={padding}
                            y1={chartHeight - padding - (v * (chartHeight - padding * 2))}
                            x2={chartWidth - padding}
                            y2={chartHeight - padding - (v * (chartHeight - padding * 2))}
                            stroke="#1e2535"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                        />
                    ))}

                    {/* Area fill */}
                    <motion.path
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1 }}
                        d={areaPath}
                        fill="url(#areaGradient)"
                    />

                    {/* Line path */}
                    <motion.path
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                        d={linePath}
                        fill="none"
                        stroke="#00c2cb"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="url(#glow)"
                    />

                    {/* Data points */}
                    {points.map((p, i) => (
                        <g key={i} className="cursor-pointer group/point">
                            <motion.circle
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 1 + i * 0.05 }}
                                cx={p.x}
                                cy={p.y}
                                r="4"
                                fill="#0a0d14"
                                stroke="#00c2cb"
                                strokeWidth="2"
                                onMouseEnter={() => setHoveredData(p)}
                                onMouseLeave={() => setHoveredData(null)}
                            />
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r="15"
                                fill="transparent"
                                onMouseEnter={() => setHoveredData(p)}
                                onMouseLeave={() => setHoveredData(null)}
                            />
                        </g>
                    ))}

                    {/* X-Axis labels */}
                    {points.filter((_, i) => i % 2 === 0).map((p, i) => (
                        <text
                            key={i}
                            x={p.x}
                            y={chartHeight - 10}
                            textAnchor="middle"
                            fill="#4a5568"
                            fontSize="10"
                            fontWeight="bold"
                            className="uppercase tracking-tighter"
                        >
                            {p.label}
                        </text>
                    ))}
                </svg>

                {/* Tooltip */}
                <AnimatePresence>
                    {hoveredData && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            className="absolute z-20 bg-[#0a0d14] border border-[#00c2cb40] p-4 rounded-2xl shadow-2xl pointer-events-none min-w-[150px]"
                            style={{
                                left: `${(timeline.indexOf(hoveredData) / (timeline.length - 1)) * 100}%`,
                                bottom: '80%',
                                transform: 'translateX(-50%)'
                            }}
                        >
                            <p className="text-[10px] font-black text-[#00c2cb] uppercase tracking-widest mb-1">{hoveredData.label}</p>
                            <div className="space-y-1">
                                <div className="flex justify-between items-center gap-4">
                                    <span className="text-[10px] font-bold text-[#4a5568]">TOTAL</span>
                                    <span className="text-xs font-black text-white">{hoveredData.total}</span>
                                </div>
                                <div className="flex justify-between items-center gap-4">
                                    <span className="text-[10px] font-bold text-[#4a5568]">VALID</span>
                                    <span className="text-xs font-black text-[#00c853]">{hoveredData.valid}</span>
                                </div>
                                <div className="flex justify-between items-center gap-4">
                                    <span className="text-[10px] font-bold text-[#4a5568]">INVALID</span>
                                    <span className="text-xs font-black text-[#ff1744]">{hoveredData.invalid}</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom Insight */}
            <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="w-6 h-6 rounded-full border-2 border-[#10131c] bg-[#1e2535] flex items-center justify-center">
                            <div className="w-1 h-1 rounded-full bg-[#00c2cb]" />
                        </div>
                    ))}
                </div>
                <p className="text-[10px] font-bold text-[#4a5568] uppercase tracking-widest">
                    Peak activity detected on <span className="text-[#e8ecf4]">{timeline.sort((a, b) => b.total - a.total)[0].label}</span> with <span className="text-[#e8ecf4]">{timeline.sort((a, b) => b.total - a.total)[0].total} investigations</span>
                </p>
            </div>
        </motion.div>
    );
}

export default function DashboardPage() {
    const [sessions, setSessions] = useState<AnalyticsSession[]>([]);
    const [stats, setStats] = useState({ total: 0, integrity: 0, fraud: 0, accuracy: 0 });
    const [loading, setLoading] = useState(true);
    const [auditEntries, setAuditEntries] = useState<any[]>([]);
    const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

    const loadData = () => {
        try {
            // ── Read analytics sessions (for activity graph / live stream) ──
            const raw = localStorage.getItem('verentis_analytics');
            if (raw) {
                const parsed: AnalyticsSession[] = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const clean = parsed.map(s => ({
                        ...s,
                        id: safeNum(s.id),
                        total: safeNum(s.total),
                        valid: safeNum(s.valid),
                        invalid: safeNum(s.invalid),
                        partial: safeNum(s.partial),
                        skipped: safeNum(s.skipped),
                        manufacturers: s.manufacturers || {},
                        states: s.states || {},
                    }));
                    setSessions(clean);
                } else {
                    setSessions([]);
                }
            } else {
                setSessions([]);
            }

            // ── Read audit log (PRIMARY source for KPI stats + widgets) ─────
            const auditRaw = localStorage.getItem('verentis_audit');
            let audit: any[] = [];
            if (auditRaw) {
                try { audit = JSON.parse(auditRaw); } catch { audit = []; }
            }
            setAuditEntries(audit);

            // ── Compute KPI stats from audit log (complete data) ────────────
            const total = audit.length;
            const valid = audit.filter((a: any) => {
                const v = (a.verdict || a.status || '').toLowerCase();
                return v === 'accepted' || v === 'clean' || v === 'valid';
            }).length;
            const invalid = audit.filter((a: any) => {
                const v = (a.verdict || a.status || '').toLowerCase();
                return v === 'rejected' || v === 'invalid' || v === 'fraud';
            }).length;
            const suspicious = audit.filter((a: any) => {
                const v = (a.verdict || a.status || '').toLowerCase();
                return v === 'suspicious' || v === 'partial' || v === 'warning';
            }).length;

            setStats({
                total,
                integrity: safePct(valid, total),
                fraud: invalid + suspicious,
                accuracy: safePct(valid + invalid + suspicious, total),
            });

            setLastUpdated(Date.now());
        } catch (e) {
            console.error("Dashboard data error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial load
        loadData();

        // TRIGGER 1 — Poll every 5 seconds
        const interval = setInterval(loadData, 5000);

        // TRIGGER 2 — Instant update when localStorage changes (from other components/tabs)
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'verentis_analytics' || e.key === 'verentis_audit') {
                loadData();
            }
        };
        window.addEventListener('storage', onStorage);

        // TRIGGER 3 — Refresh when user switches back to this tab/page
        const onVisible = () => {
            if (document.visibilityState === 'visible') loadData();
        };
        const onFocus = () => loadData();
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', onStorage);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', onFocus);
        };
    }, []);

    // ── Aggregate manufacturer & state counts ───────────────────────────────
    const mfrTotals: Record<string, number> = {};
    const stateTotals: Record<string, number> = {};
    sessions.forEach(s => {
        Object.entries(s.manufacturers || {}).forEach(([k, v]) => {
            mfrTotals[k] = (mfrTotals[k] || 0) + safeNum(v);
        });
        Object.entries(s.states || {}).forEach(([k, v]) => {
            stateTotals[k] = (stateTotals[k] || 0) + safeNum(v);
        });
    });
    const topStates = Object.entries(stateTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    const maxStateCount = topStates[0]?.[1] || 1;

    // ── Widget data prep ─────────────────────────────────────────────────
    const totalDocs = sessions.reduce((a, s) => a + s.total, 0);
    const totalInvalid = sessions.reduce((a, s) => a + s.invalid, 0);
    const totalPartial = sessions.reduce((a, s) => a + s.partial, 0);
    const fraudScore = totalDocs > 0 ? Math.round(((totalInvalid + totalPartial) / totalDocs) * 100) : 0;

    // Sparkline: last 7 sessions for each KPI
    const last7 = sessions.slice(-7);
    const sparkTotal = last7.map(s => s.total);
    const sparkIntegrity = last7.map(s => s.total > 0 ? Math.round((s.valid / s.total) * 100) : 0);
    const sparkFraud = last7.map(s => s.invalid);
    const sparkAccuracy = last7.map(s => s.total > 0 ? Math.round(((s.valid + s.invalid) / s.total) * 100) : 0);

    // Manufacturer sorted
    const mfrSorted: [string, number][] = Object.entries(mfrTotals).sort((a, b) => b[1] - a[1]);

    // Donut categories from audit (reactive via auditEntries state)
    const donutData = (() => {
        const cats: Record<string, number> = {};
        auditEntries.forEach((a: any) => { const c = a.category || "UNKNOWN"; cats[c] = (cats[c] || 0) + 1; });
        return Object.entries(cats).map(([label, value]) => ({ label, value }));
    })();

    // Timeline items from audit (reactive)
    const timelineItems = auditEntries.slice(-10).reverse().map((a: any) => {
        const d = safeDate(a.timestamp);
        const ago = d ? (() => { const m = Math.floor((Date.now() - d.getTime()) / 60000); return m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`; })() : "";
        return { filename: a.fileName || "Unknown", verdict: a.status || "unknown", category: a.category || "", time: ago };
    });

    // Ticker items from audit (reactive)
    const tickerItems = auditEntries.slice(-20).reverse().map((a: any) => {
        const d = safeDate(a.timestamp);
        const ago = d ? (() => { const m = Math.floor((Date.now() - d.getTime()) / 60000); return m < 1 ? "now" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`; })() : "";
        return { filename: a.fileName || "Unknown", verdict: a.status || "unknown", timeAgo: ago };
    });

    // Calendar day counts
    const dayCounts: Record<string, number> = {};
    sessions.forEach(s => {
        const d = safeDate(s.date);
        if (d) { const key = d.toISOString().split("T")[0]; dayCounts[key] = (dayCounts[key] || 0) + s.invalid; }
    });


    // ── Dynamic insight ─────────────────────────────────────────────────────
    const insightText = (() => {
        if (sessions.length === 0) return "No forensic sessions recorded yet. Run an analysis from the Document Analysis tab to populate this dashboard.";
        const total = sessions.reduce((a, s) => a + s.total, 0);
        const fraud = sessions.reduce((a, s) => a + s.invalid, 0);
        const partial = sessions.reduce((a, s) => a + s.partial, 0);
        const topMfr = Object.entries(mfrTotals).sort((a, b) => b[1] - a[1])[0];
        const topState = topStates[0];
        const fraudPct = safePct(fraud, total);
        if (fraudPct > 30) return `High fraud rate detected: ${fraudPct}% of ${total} scans flagged as invalid. Immediate manual review recommended.`;
        if (topMfr && topState) return `Top manufacturer: ${topMfr[0]} (${topMfr[1]} docs). Highest volume state: ${topState[0]} (${topState[1]} scans). ${partial} documents show partial extraction — consider rescanning.`;
        if (topMfr) return `${topMfr[0]} leads with ${topMfr[1]} vehicles scanned. System integrity at ${safePct(sessions.reduce((a, s) => a + s.valid, 0), total)}%.`;
        return `${total} total documents processed across ${sessions.length} forensic sessions. Platform operating within normal parameters.`;
    })();

    return (
        <div className="min-h-full bg-[#050810] text-[#e8ecf4] p-8 font-sans">
            {/* Ambient glows */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#00c2cb] opacity-[0.05] rounded-full blur-[150px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#0088ff] opacity-[0.03] rounded-full blur-[120px]" />
            </div>

            <div className="max-w-[1400px] mx-auto relative z-10 space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#1e2535]">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-4xl font-black tracking-tighter uppercase text-white">Threat Intelligence</h1>
                            <div className="flex items-center gap-2 px-3 py-1 bg-[#00c2cb10] border border-[#00c2cb30] rounded-full">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00c2cb] opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00c2cb]" />
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#00c2cb]">Real-time Nexus</span>
                            </div>
                        </div>
                        <p className="text-sm text-[#4a5568] font-medium mt-1">
                            Synchronized forensic monitoring across <span className="text-[#00c2cb] font-bold">Identity</span>, <span className="text-[#00c2cb] font-bold">Finance</span>, and <span className="text-[#00c2cb] font-bold">Automotive</span> intelligence sectors.
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0a0d14] border border-[#1e2535] rounded-xl">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00c853] opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00c853]" />
                            </span>
                            <span className="text-[9px] font-bold text-[#4a5568] uppercase tracking-widest">
                                Synced {Math.floor((Date.now() - lastUpdated) / 1000) < 5 ? 'just now' : `${Math.floor((Date.now() - lastUpdated) / 1000)}s ago`}
                            </span>
                        </div>
                        <div className="p-4 bg-[#10131c] border border-[#1e2535] rounded-2xl flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-[9px] font-black text-[#4a5568] uppercase tracking-widest">Active Agency</p>
                                <p className="text-xs font-bold text-[#e8ecf4]">Verentis Core Engine v4.0</p>
                            </div>
                            <div className="w-10 h-10 bg-[#00c2cb] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(0,194,203,0.3)]">
                                <Zap className="w-5 h-5 text-[#0a0d14]" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* FEATURE 2 — Live Ticker */}
                <LiveTicker items={tickerItems} />

                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <KPICard title="Total Investigations" value={sessions.length === 0 ? '—' : stats.total.toLocaleString()} sub="Cumulative scans" icon={<FileText className="w-6 h-6" />} color="#00c2cb" sparkData={sparkTotal} />
                    <KPICard title="Forensic Integrity" value={sessions.length === 0 ? '—' : `${stats.integrity}%`} sub="Clean certificate rate" icon={<Shield className="w-6 h-6" />} color="#00c853" sparkData={sparkIntegrity} sparkColor="#00c853" />
                    <KPICard title="Fraud Intercepted" value={sessions.length === 0 ? '—' : stats.fraud.toLocaleString()} sub="Tampered documents" icon={<AlertTriangle className="w-6 h-6" />} color="#ff1744" sparkData={sparkFraud} sparkColor="#ff4757" />
                    <KPICard title="Neural Accuracy" value={sessions.length === 0 ? '—' : `${stats.accuracy}%`} sub="Extraction success rate" icon={<Zap className="w-6 h-6" />} color="#0088ff" sparkData={sparkAccuracy} sparkColor="#0088ff" />
                </div>

                {/* Activity Graph — full width */}
                <ActivityGraph sessions={sessions} />

                {/* Middle row: Donut + Manufacturer + Calendar */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    <DonutChart data={donutData} />
                    <ManufacturerBoard data={mfrSorted} />
                    <FraudCalendar dayCounts={dayCounts} />
                </div>


                {/* Bottom row: Live Stream + Timeline */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                    {/* Live Session Stream */}
                    <div className="xl:col-span-6">
                        <div className="bg-[#10131c]/50 backdrop-blur-md border border-[#1e2535] rounded-3xl overflow-hidden flex flex-col shadow-2xl h-full">
                            <div className="px-6 py-5 bg-[#0a0d14] border-b border-[#1e2535] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Activity className="w-4 h-4 text-[#00c2cb]" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Live Stream</span>
                                </div>
                                <span className="text-[9px] font-bold text-[#4a5568] uppercase tracking-widest">
                                    {sessions.length} Session{sessions.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[400px]">
                                {sessions.length === 0 ? (
                                    <div className="py-16 text-center opacity-20 flex flex-col items-center gap-4">
                                        <Clock className="w-12 h-12" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">Waiting for sessions...</p>
                                    </div>
                                ) : (
                                    [...sessions].reverse().slice(0, 5).map((s, i) => {
                                        const pct = safePct(s.valid, s.total);
                                        const d = safeDate(s.date);
                                        const timeLabel = d ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
                                        const dateLabel = d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
                                        return (
                                            <div key={i} className="p-4 bg-[#0a0d14] border border-[#1e2535] rounded-2xl group hover:border-[#00c2cb20] transition-all">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-lg bg-[#1e2535] flex items-center justify-center">
                                                            <Fingerprint className="w-4 h-4 text-[#4a5568] group-hover:text-[#00c2cb] transition-colors" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-black text-[#e8ecf4] uppercase">BATCH #{i + 1}</p>
                                                            <p className="text-[8px] font-bold text-[#4a5568] uppercase">{dateLabel} · {timeLabel}</p>
                                                        </div>
                                                    </div>
                                                    <div className={cn(
                                                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border",
                                                        s.invalid > 0
                                                            ? "bg-red-500/10 border-red-500/30 text-red-400"
                                                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                                    )}>
                                                        {s.invalid > 0 ? 'Threat Found' : 'Clean'}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex justify-between text-[8px] font-black text-[#4a5568] uppercase">
                                                            <span>Accuracy</span>
                                                            <span>{pct}%</span>
                                                        </div>
                                                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct >= 70 ? '#00c853' : pct >= 40 ? '#ffab00' : '#ff1744' }} />
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-[11px] font-black text-[#e8ecf4]">{s.total}</p>
                                                        <p className="text-[8px] font-bold text-[#4a5568] uppercase">Docs</p>
                                                    </div>
                                                </div>
                                                {/* Per-session breakdown */}
                                                <div className="flex gap-3 mt-2 pt-2 border-t border-white/5">
                                                    <span className="text-[8px] text-[#00c853] font-bold">✓ {s.valid} valid</span>
                                                    {s.invalid > 0 && <span className="text-[8px] text-[#ff1744] font-bold">✗ {s.invalid} invalid</span>}
                                                    {s.partial > 0 && <span className="text-[8px] text-[#ffab00] font-bold">~ {s.partial} partial</span>}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="p-4 bg-[#0a0d14] border-t border-[#1e2535]">
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <p className="text-base font-black text-[#00c853]">{sessions.reduce((a, s) => a + s.valid, 0)}</p>
                                        <p className="text-[8px] text-[#4a5568] font-black uppercase">Valid</p>
                                    </div>
                                    <div>
                                        <p className="text-base font-black text-[#ff1744]">{sessions.reduce((a, s) => a + s.invalid, 0)}</p>
                                        <p className="text-[8px] text-[#4a5568] font-black uppercase">Invalid</p>
                                    </div>
                                    <div>
                                        <p className="text-base font-black text-[#ffab00]">{sessions.reduce((a, s) => a + s.partial, 0)}</p>
                                        <p className="text-[8px] text-[#4a5568] font-black uppercase">Partial</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FEATURE 8 — Verification Timeline */}
                    <div className="xl:col-span-6">
                        <VerificationTimeline items={timelineItems} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function KPICard({ title, value, sub, icon, color, sparkData, sparkColor }: { title: string; value: string; sub: string; icon: React.ReactNode; color: string; sparkData?: number[]; sparkColor?: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#10131c]/50 backdrop-blur-md border border-[#1e2535] rounded-3xl p-6 relative overflow-hidden group hover:border-[#00c2cb40] transition-all"
        >
            <div className="flex justify-between items-start relative z-10">
                <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#0a0d14] border border-[#1e2535] flex items-center justify-center group-hover:scale-110 transition-transform duration-500" style={{ color }}>
                        {icon}
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-white tracking-tighter">{value}</h3>
                        <p className="text-[10px] font-black text-[#4a5568] uppercase tracking-widest mt-1">{title}</p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center">
                        <ArrowUpRight className="w-4 h-4 text-[#4a5568]" />
                    </div>
                    <span className="text-[9px] font-bold text-[#4a5568] uppercase text-right leading-none max-w-[60px]">{sub}</span>
                </div>
            </div>
            {/* FEATURE 3 — Sparkline */}
            {sparkData && sparkData.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 z-0 opacity-60">
                    <Sparkline data={sparkData} color={sparkColor || color} width={300} height={40} />
                </div>
            )}
            {/* Ambient glow */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 blur-3xl rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-1000" style={{ backgroundColor: color }} />
        </motion.div>
    );
}
