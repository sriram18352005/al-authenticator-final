"use client";

import React, { useState, useEffect } from 'react';

export default function AnalyticsDashboard() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('30d');
    const [animTrigger, setAnimTrigger] = useState(false);

    useEffect(() => {
        const load = () => {
            const data = JSON.parse(
                localStorage.getItem('verentis_analytics') || '[]'
            );
            // Consistent with VehicleModule logic
            setSessions(Array.isArray(data) ? data : (data.sessions || []));
            setTimeout(() => setAnimTrigger(true), 100);
        };
        load();
        window.addEventListener('storage', load);

        const style = document.createElement('style');
        style.innerHTML = `
      @keyframes countUp {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes barGrow {
        from { width: 0% !important; }
      }
      @keyframes arcDraw {
        from { stroke-dasharray: 0 1000; }
      }
      @keyframes fadeSlideIn {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes glowPulse {
        0%,100% { box-shadow: 0 0 8px rgba(0,194,203,0.3); }
        50%      { box-shadow: 0 0 20px rgba(0,194,203,0.6); }
      }
      @keyframes shimmerBar {
        0%   { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .analytics-bar {
        transition: width 1.2s cubic-bezier(0.34,1.1,0.64,1);
        position: relative;
        overflow: hidden;
      }
      .analytics-bar::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255,255,255,0.15) 50%,
          transparent 100%
        );
        background-size: 200% 100%;
        animation: shimmerBar 2s linear infinite;
      }
      .analytics-kpi {
        animation: fadeSlideIn 0.5s ease forwards;
      }
      .analytics-kpi:nth-child(1) { animation-delay: 0ms; }
      .analytics-kpi:nth-child(2) { animation-delay: 80ms; }
      .analytics-kpi:nth-child(3) { animation-delay: 160ms; }
      .analytics-kpi:nth-child(4) { animation-delay: 240ms; }
      .analytics-row-enter {
        animation: fadeSlideIn 0.4s ease forwards;
      }
      .donut-arc {
        transition: stroke-dasharray 1.4s cubic-bezier(0.34,1.1,0.64,1);
      }
      .kpi-hover:hover {
        transform: translateY(-4px) !important;
        border-color: rgba(255,255,255,0.15) !important;
      }
    `;
        document.head.appendChild(style);

        return () => {
            window.removeEventListener('storage', load);
            document.head.removeChild(style);
        };
    }, []);

    useEffect(() => {
        setAnimTrigger(false);
        setTimeout(() => setAnimTrigger(true), 100);
    }, [period]);

    const filtered = sessions.filter(s => {
        if (period === 'all') return true;
        const days = period === '7d' ? 7 : 30;
        return new Date(s.date) >
            new Date(Date.now() - days * 86400000);
    });

    const totals = filtered.reduce((acc, s) => ({
        total: acc.total + (s.total || 0),
        valid: acc.valid + (s.valid || 0),
        invalid: acc.invalid + (s.invalid || 0),
        partial: acc.partial + (s.partial || 0),
        skipped: acc.skipped + (s.skipped || 0),
    }), { total: 0, valid: 0, invalid: 0, partial: 0, skipped: 0 });

    const accuracy = totals.total > 0
        ? Math.round((totals.valid / totals.total) * 100) : 0;

    const mfrMap: Record<string, number> = {};
    filtered.forEach(s =>
        Object.entries(s.manufacturers || {}).forEach(([k, v]) => {
            mfrMap[k] = (mfrMap[k] || 0) + (v as number);
        })
    );
    const topMfr = Object.entries(mfrMap)
        .sort((a, b) => b[1] - a[1]).slice(0, 8);

    const stateMap: Record<string, number> = {};
    filtered.forEach(s =>
        Object.entries(s.states || {}).forEach(([k, v]) => {
            stateMap[k] = (stateMap[k] || 0) + (v as number);
        })
    );
    const topStates = Object.entries(stateMap)
        .sort((a, b) => b[1] - a[1]).slice(0, 10);

    const BAR_COLORS = [
        { main: '#00c2cb', glow: 'rgba(0,194,203,0.3)' },
        { main: '#0088ff', glow: 'rgba(0,136,255,0.3)' },
        { main: '#00c853', glow: 'rgba(0,200,83,0.3)' },
        { main: '#ffab00', glow: 'rgba(255,171,0,0.3)' },
        { main: '#ff6d00', glow: 'rgba(255,109,0,0.3)' },
        { main: '#9c27b0', glow: 'rgba(156,39,176,0.3)' },
        { main: '#ff1744', glow: 'rgba(255,23,68,0.3)' },
        { main: '#00bcd4', glow: 'rgba(0,188,212,0.3)' },
    ];

    return (
        <div style={{
            background: '#050810',
            minHeight: '100vh',
            padding: '32px 28px',
            position: 'relative',
            overflow: 'hidden',
            color: '#e8ecf4',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>

            {/* Ambient background glows */}
            <div style={{
                position: 'fixed', inset: 0,
                pointerEvents: 'none', zIndex: 0
            }}>
                <div style={{
                    position: 'absolute',
                    width: 700, height: 700,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0,194,203,0.04) 0%, transparent 65%)',
                    top: '-15%', left: '-10%'
                }} />
                <div style={{
                    position: 'absolute',
                    width: 500, height: 500,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0,136,255,0.03) 0%, transparent 65%)',
                    top: '50%', right: '-5%'
                }} />
                <div style={{
                    position: 'absolute',
                    width: 400, height: 400,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0,200,83,0.02) 0%, transparent 65%)',
                    bottom: '5%', left: '35%'
                }} />
            </div>

            <div style={{ position: 'relative', zIndex: 1 }}>
                {/* SECTION 1 — HEADER */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', marginBottom: 32
                }}>
                    <div>
                        <div style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: '4px',
                            color: '#00c2cb', textTransform: 'uppercase',
                            marginBottom: 8, display: 'flex',
                            alignItems: 'center', gap: 8
                        }}>
                            <div style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: '#00c2cb',
                                boxShadow: '0 0 10px #00c2cb',
                                animation: 'glowPulse 2s infinite'
                            }} />
                            Verentis Forensic Intelligence
                        </div>
                        <h1 style={{
                            fontSize: 28, fontWeight: 900, color: '#e8ecf4',
                            margin: '0 0 6px', letterSpacing: '-0.8px'
                        }}>
                            Analytics Dashboard
                        </h1>
                        <p style={{ fontSize: 13, color: '#4a5568', margin: 0 }}>
                            {filtered.length} sessions · {totals.total} documents analyzed · {accuracy}% accuracy rate
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{
                            display: 'flex', gap: 3,
                            background: '#0a0d14',
                            border: '1px solid #1e2535',
                            borderRadius: 10, padding: 3
                        }}>
                            {[
                                { key: '7d', label: '7D' },
                                { key: '30d', label: '30D' },
                                { key: 'all', label: 'ALL' },
                            ].map(p => (
                                <button key={p.key}
                                    onClick={() => setPeriod(p.key as any)}
                                    style={{
                                        padding: '6px 16px', borderRadius: 8,
                                        border: 'none', cursor: 'pointer',
                                        fontSize: 10, fontWeight: 800,
                                        letterSpacing: '1px',
                                        background: period === p.key
                                            ? 'linear-gradient(135deg, #00c2cb, #00a8b5)'
                                            : 'transparent',
                                        color: period === p.key ? '#000' : '#4a5568',
                                        boxShadow: period === p.key
                                            ? '0 2px 12px rgba(0,194,203,0.35)' : 'none',
                                        transition: 'all 0.25s'
                                    }}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => {
                                if (window.confirm('Clear all analytics data?')) {
                                    localStorage.removeItem('verentis_analytics');
                                    setSessions([]);
                                }
                            }}
                            style={{
                                background: 'rgba(255,23,68,0.08)',
                                border: '1px solid rgba(255,23,68,0.2)',
                                color: '#ff5252', padding: '8px 16px',
                                borderRadius: 8, fontSize: 10,
                                fontWeight: 700, cursor: 'pointer',
                                letterSpacing: '1px'
                            }}
                        >
                            CLEAR DATA
                        </button>
                    </div>
                </div>

                {/* SECTION 2 — KPI CARDS */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 16, marginBottom: 24
                }}>
                    {[
                        {
                            label: 'Total Processed',
                            value: totals.total,
                            sub: `${filtered.length} sessions`,
                            color: '#00c2cb',
                            icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                            )
                        },
                        {
                            label: 'Valid Documents',
                            value: totals.valid,
                            sub: `${accuracy}% accuracy`,
                            color: '#00c853',
                            icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
                                </svg>
                            )
                        },
                        {
                            label: 'Invalid / Fake',
                            value: totals.invalid,
                            sub: `${totals.total > 0 ? Math.round((totals.invalid / totals.total) * 100) : 0}% flagged`,
                            color: '#ff1744',
                            icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" />
                                </svg>
                            )
                        },
                        {
                            label: 'Partial Matches',
                            value: totals.partial,
                            sub: 'One ID missing',
                            color: '#ffab00',
                            icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                            )
                        },
                    ].map((k, i) => (
                        <div key={k.label}
                            className="analytics-kpi kpi-hover"
                            style={{
                                background: 'rgba(255,255,255,0.025)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                borderRadius: 16, padding: '24px',
                                position: 'relative', overflow: 'hidden',
                                transition: 'transform 0.25s, border-color 0.25s',
                                cursor: 'default',
                                animationDelay: `${i * 80}ms`
                            }}
                        >
                            <div style={{
                                position: 'absolute', top: 0,
                                left: 0, right: 0, height: 1,
                                background: `linear-gradient(90deg, transparent, ${k.color}60, transparent)`
                            }} />
                            <div style={{
                                position: 'absolute',
                                top: -50, right: -30,
                                width: 120, height: 120,
                                borderRadius: '50%',
                                background: `radial-gradient(circle, ${k.color}08 0%, transparent 70%)`,
                                pointerEvents: 'none'
                            }} />

                            <div style={{
                                display: 'flex', justifyContent: 'space-between',
                                alignItems: 'flex-start', marginBottom: 20
                            }}>
                                <span style={{
                                    fontSize: 8, fontWeight: 800,
                                    letterSpacing: '2px', color: '#4a5568',
                                    textTransform: 'uppercase'
                                }}>
                                    {k.label}
                                </span>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    background: `${k.color}12`,
                                    border: `1px solid ${k.color}25`,
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', color: k.color
                                }}>
                                    {k.icon}
                                </div>
                            </div>

                            <div style={{
                                fontSize: 42, fontWeight: 900, color: k.color,
                                lineHeight: 1, marginBottom: 8,
                                fontVariantNumeric: 'tabular-nums',
                                textShadow: `0 0 30px ${k.color}40`
                            }}>
                                {animTrigger ? k.value : 0}
                            </div>

                            <div style={{
                                fontSize: 11, color: '#4a5568', marginBottom: 16
                            }}>
                                {k.sub}
                            </div>

                            <div style={{
                                height: 3, background: '#1e2535',
                                borderRadius: 3, overflow: 'hidden'
                            }}>
                                <div className="analytics-bar" style={{
                                    height: '100%', borderRadius: 3,
                                    background: `linear-gradient(90deg, ${k.color}, ${k.color}80)`,
                                    width: animTrigger && totals.total > 0
                                        ? `${Math.round((k.value / totals.total) * 100)}%`
                                        : '0%',
                                    boxShadow: `0 0 8px ${k.color}50`
                                }} />
                            </div>
                            <div style={{
                                fontSize: 9, color: `${k.color}80`,
                                marginTop: 4, textAlign: 'right', fontWeight: 700
                            }}>
                                {totals.total > 0 ? `${Math.round((k.value / totals.total) * 100)}%` : '—'}
                            </div>
                        </div>
                    ))}
                </div>

                {/* SECTION 3 — LARGE CHARTS ROW */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1.4fr 1fr',
                    gap: 16, marginBottom: 24
                }}>
                    {/* LEFT: LARGE MANUFACTURER BAR CHART */}
                    <div style={{
                        background: '#0a0d14', border: '1px solid #1e2535',
                        borderRadius: 16, padding: '28px'
                    }}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'flex-start', marginBottom: 28
                        }}>
                            <div>
                                <div style={{
                                    fontSize: 9, fontWeight: 800, letterSpacing: '2.5px',
                                    color: '#00c2cb', textTransform: 'uppercase',
                                    marginBottom: 6
                                }}>
                                    Manufacturer Intelligence
                                </div>
                                <div style={{
                                    fontSize: 18, fontWeight: 800, color: '#e8ecf4'
                                }}>
                                    Top Vehicle Manufacturers
                                </div>
                                <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>
                                    Detected via WMI prefix across all batches
                                </div>
                            </div>
                            <div style={{
                                background: 'rgba(0,194,203,0.08)',
                                border: '1px solid rgba(0,194,203,0.2)',
                                borderRadius: 8, padding: '6px 14px',
                                fontSize: 11, color: '#00c2cb', fontWeight: 700
                            }}>
                                {topMfr.length} brands
                            </div>
                        </div>

                        {topMfr.length === 0 ? (
                            <div style={{
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                padding: '60px 0', gap: 12
                            }}>
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1e2535" strokeWidth="1.5">
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                                </svg>
                                <div style={{ fontSize: 13, color: '#2d3748', textAlign: 'center' }}>
                                    No manufacturer data yet<br />
                                    <span style={{ fontSize: 11, color: '#1e2535' }}>Run a batch analysis to populate this chart</span>
                                </div>
                            </div>
                        ) : topMfr.map(([name, count], i) => {
                            const max = topMfr[0][1] as number;
                            const pct = Math.round((count / max) * 100);
                            const col = BAR_COLORS[i % BAR_COLORS.length];
                            return (
                                <div key={name} style={{ marginBottom: 18 }}>
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between',
                                        alignItems: 'center', marginBottom: 7
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{
                                                width: 22, height: 22, borderRadius: 6,
                                                background: `${col.main}15`,
                                                border: `1px solid ${col.main}30`,
                                                display: 'flex', alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 9, fontWeight: 800, color: col.main
                                            }}>
                                                {i + 1}
                                            </div>
                                            <span style={{
                                                fontSize: 13, color: '#e8ecf4',
                                                fontWeight: 700, letterSpacing: '0.3px'
                                            }}>
                                                {name}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span style={{ fontSize: 11, color: col.main, fontWeight: 800, fontFamily: 'monospace' }}>{pct}%</span>
                                            <span style={{
                                                fontSize: 13, fontWeight: 800,
                                                color: '#e8ecf4', fontFamily: 'monospace',
                                                background: `${col.main}10`,
                                                border: `1px solid ${col.main}20`,
                                                borderRadius: 6, padding: '2px 10px'
                                            }}>
                                                {count}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{
                                        height: 10, background: '#0d1020',
                                        borderRadius: 10, overflow: 'hidden',
                                        border: '1px solid #1e2535',
                                        position: 'relative'
                                    }}>
                                        <div className="analytics-bar" style={{
                                            height: '100%',
                                            width: animTrigger ? `${pct}%` : '0%',
                                            background: `linear-gradient(90deg, ${col.main}, ${col.main}bb)`,
                                            borderRadius: 10,
                                            boxShadow: `0 0 12px ${col.glow}`,
                                        }} />
                                        {[25, 50, 75].map(t => (
                                            <div key={t} style={{
                                                position: 'absolute', top: 0, bottom: 0,
                                                left: `${t}%`,
                                                width: 1, background: 'rgba(255,255,255,0.04)'
                                            }} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* RIGHT: LARGE DONUT CHART */}
                    <div style={{
                        background: '#0a0d14', border: '1px solid #1e2535',
                        borderRadius: 16, padding: '28px'
                    }}>
                        <div style={{ marginBottom: 24 }}>
                            <div style={{
                                fontSize: 9, fontWeight: 800, letterSpacing: '2.5px',
                                color: '#00c2cb', textTransform: 'uppercase',
                                marginBottom: 6
                            }}>
                                Document Intelligence
                            </div>
                            <div style={{
                                fontSize: 18, fontWeight: 800, color: '#e8ecf4'
                            }}>
                                Status Distribution
                            </div>
                            <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>
                                Across {totals.total} analyzed documents
                            </div>
                        </div>

                        {/* LARGE SVG Donut */}
                        {(() => {
                            const DIST = [
                                { label: 'Valid', value: totals.valid, color: '#00c853', bg: '#0a1f10' },
                                { label: 'Invalid', value: totals.invalid, color: '#ff1744', bg: '#1a0808' },
                                { label: 'Partial', value: totals.partial, color: '#ffab00', bg: '#1a1200' },
                                { label: 'Skipped', value: totals.skipped, color: '#4a5568', bg: '#0d0f14' },
                            ];
                            const cx = 100, cy = 100, r = 72, strokeW = 18;
                            const circ = 2 * Math.PI * r;
                            let cumDash = 0;

                            return (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24, position: 'relative' }}>
                                        <svg width="200" height="200" viewBox="0 0 200 200">
                                            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2535" strokeWidth={strokeW} />
                                            <defs>
                                                <filter id="glowDash">
                                                    <feGaussianBlur stdDeviation="3" result="blur" />
                                                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                                                </filter>
                                            </defs>
                                            {totals.total > 0 && DIST.filter(d => d.value > 0).map((d, i) => {
                                                const dash = animTrigger ? (d.value / totals.total) * circ : 0;
                                                const gap = circ - dash;
                                                const offset = circ * 0.25 - cumDash;
                                                cumDash += (d.value / totals.total) * circ;
                                                return (
                                                    <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                                                        stroke={d.color} strokeWidth={strokeW}
                                                        strokeDasharray={`${dash} ${gap}`}
                                                        strokeDashoffset={offset}
                                                        strokeLinecap="round"
                                                        className="donut-arc"
                                                        style={{ filter: `drop-shadow(0 0 6px ${d.color}80)` }}
                                                    />
                                                );
                                            })}
                                            <text x={cx} y={cy - 14} textAnchor="middle" fill="#e8ecf4" fontSize="28" fontWeight="900">{accuracy}%</text>
                                            <text x={cx} y={cy + 4} textAnchor="middle" fill="#4a5568" fontSize="9" fontWeight="700" letterSpacing="2">ACCURACY</text>
                                            <text x={cx} y={cy + 20} textAnchor="middle" fill="#2d3748" fontSize="8">{totals.total} docs</text>
                                        </svg>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {DIST.map(d => (
                                            <div key={d.label} style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '10px 14px', background: d.bg,
                                                border: `1px solid ${d.color}20`, borderRadius: 10, transition: 'transform 0.2s'
                                            }}
                                                onMouseEnter={e => (e.currentTarget.style.transform = 'translateX(4px)')}
                                                onMouseLeave={e => (e.currentTarget.style.transform = 'translateX(0)')}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, boxShadow: `0 0 8px ${d.color}80`, flexShrink: 0 }} />
                                                    <span style={{ fontSize: 12, color: '#e8ecf4', fontWeight: 600 }}>{d.label}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 60, height: 3, background: '#1e2535', borderRadius: 3, overflow: 'hidden' }}>
                                                        <div className="analytics-bar" style={{
                                                            height: '100%', borderRadius: 3, background: d.color,
                                                            width: animTrigger && totals.total > 0 ? `${Math.round((d.value / totals.total) * 100)}%` : '0%'
                                                        }} />
                                                    </div>
                                                    <span style={{ fontSize: 13, fontWeight: 800, color: d.color, minWidth: 24, textAlign: 'right', fontFamily: 'monospace' }}>{d.value}</span>
                                                    <span style={{ fontSize: 10, color: '#4a5568', minWidth: 32, textAlign: 'right' }}>{totals.total > 0 ? `${Math.round((d.value / totals.total) * 100)}%` : '0%'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* SECTION 4 — BOTTOM ROW */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 1fr',
                    gap: 16
                }}>
                    {/* LEFT: RECENT SESSIONS TABLE */}
                    <div style={{
                        background: '#0a0d14', border: '1px solid #1e2535',
                        borderRadius: 16, overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '20px 24px', borderBottom: '1px solid #1e2535',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'linear-gradient(90deg, #0a0d14, #0d1020)'
                        }}>
                            <div>
                                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '2px', color: '#00c2cb', textTransform: 'uppercase', marginBottom: 4 }}>Session History</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#e8ecf4' }}>Recent Batch Sessions</div>
                            </div>
                            <span style={{ fontSize: 10, color: '#4a5568', background: '#1e2535', borderRadius: 6, padding: '5px 12px', fontWeight: 700 }}>{filtered.length} sessions</span>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#080c14' }}>
                                    {['Date & Time', 'Total', 'Valid', 'Invalid', 'Partial', 'Accuracy'].map(h => (
                                        <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 8, fontWeight: 800, letterSpacing: '1.5px', color: '#4a5568', textTransform: 'uppercase', borderBottom: '1px solid #1e2535' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontSize: 12, color: '#2d3748' }}>No sessions yet — run a batch to see history</td></tr>
                                ) : filtered.slice().reverse().slice(0, 10).map((s, i) => {
                                    const acc = s.total > 0 ? Math.round((s.valid / s.total) * 100) : 0;
                                    return (
                                        <tr key={s.id} className="analytics-row-enter" style={{ background: i % 2 === 0 ? '#0a0d14' : '#080c14', borderBottom: '1px solid rgba(30,37,53,0.5)', transition: 'background 0.15s', animationDelay: `${i * 40}ms` }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#0d1020')}
                                            onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#0a0d14' : '#080c14')}
                                        >
                                            <td style={{ padding: '12px 16px', fontSize: 11, color: '#c8d0e0', fontFamily: 'monospace' }}>
                                                <div style={{ fontWeight: 600 }}>{new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                                <div style={{ fontSize: 9, color: '#4a5568', marginTop: 2 }}>{new Date(s.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 800, color: '#e8ecf4', fontFamily: 'monospace' }}>{s.total}</td>
                                            <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 800, color: '#00c853', fontFamily: 'monospace' }}>{s.valid}</td>
                                            <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 800, color: '#ff1744', fontFamily: 'monospace' }}>{s.invalid}</td>
                                            <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 800, color: '#ffab00', fontFamily: 'monospace' }}>{s.partial}</td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ height: 4, width: 50, background: '#1e2535', borderRadius: 4, overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', borderRadius: 4, width: `${acc}%`, background: acc >= 80 ? '#00c853' : acc >= 60 ? '#ffab00' : '#ff1744', transition: 'width 0.8s ease' }} />
                                                    </div>
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: acc >= 80 ? '#00c853' : acc >= 60 ? '#ffab00' : '#ff1744' }}>{acc}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* RIGHT: TOP STATES CHART */}
                    <div style={{
                        background: '#0a0d14', border: '1px solid #1e2535',
                        borderRadius: 16, padding: '24px'
                    }}>
                        <div style={{ marginBottom: 22 }}>
                            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '2px', color: '#00c2cb', textTransform: 'uppercase', marginBottom: 6 }}>Geographic Intelligence</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#e8ecf4' }}>Top States</div>
                            <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>By vehicle registration detections</div>
                        </div>

                        {topStates.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12, color: '#2d3748' }}>No state data yet</div>
                        ) : topStates.map(([state, count], i) => {
                            const max = topStates[0][1] as number;
                            const pct = Math.round((count / max) * 100);
                            const stateColors = ['#0088ff', '#00a8b5', '#0077ee', '#006fdd', '#0055bb', '#004499', '#0033aa', '#00c2cb', '#0099cc', '#0077aa'];
                            const col = stateColors[i % stateColors.length];
                            return (
                                <div key={state} style={{ marginBottom: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <span style={{ fontSize: 12, color: '#e8ecf4', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
                                            <span style={{ fontSize: 13 }}>🇮🇳</span> {state}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 10, color: col, fontWeight: 800 }}>{pct}%</span>
                                            <span style={{ fontSize: 11, fontWeight: 800, color: '#e8ecf4', fontFamily: 'monospace', background: `${col}12`, border: `1px solid ${col}25`, borderRadius: 5, padding: '1px 8px' }}>{count}</span>
                                        </div>
                                    </div>
                                    <div style={{ height: 7, background: '#0d1020', borderRadius: 7, overflow: 'hidden', border: '1px solid #1e2535' }}>
                                        <div className="analytics-bar" style={{ height: '100%', width: animTrigger ? `${pct}%` : '0%', background: `linear-gradient(90deg, ${col}, ${col}88)`, borderRadius: 7, boxShadow: `0 0 8px ${col}40` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
