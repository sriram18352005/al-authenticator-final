"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { FileText, ArrowUp, ArrowDown, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

/* ═══════ FEATURE 10 — Counter Animation Hook ═══════ */
export function useCountUp(target: number, duration = 1500, start = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start || target === 0) { setValue(target); return; }
    const t0 = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setValue(Math.floor(e * target));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return value;
}

export function CountUpNumber({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) {
  const v = useCountUp(value);
  return <>{prefix}{v.toLocaleString()}{suffix}</>;
}

/* ═══════ FEATURE 1 — Fraud Risk Gauge ═══════ */
export function FraudGauge({ score }: { score: number }) {
  const [animScore, setAnimScore] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimScore(score), 100); return () => clearTimeout(t); }, [score]);
  const clamp = Math.min(Math.max(animScore, 0), 100);
  const angle = -90 + (clamp / 100) * 180;
  const color = clamp <= 40 ? "#00d4aa" : clamp <= 70 ? "#ffa502" : "#ff4757";
  const label = clamp <= 40 ? "LOW RISK" : clamp <= 70 ? "MODERATE RISK" : "HIGH RISK";
  const r = 90, cx = 120, cy = 110;
  const arc = (a: number) => {
    const rad = (a * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const s = arc(-180), e = arc(0);
  const needleRad = ((angle - 90) * Math.PI) / 180;
  const nx = cx + (r - 15) * Math.cos(needleRad);
  const ny = cy + (r - 15) * Math.sin(needleRad);

  return (
    <div style={{ background: "#0d1526", border: "0.5px solid #1a2744", borderRadius: 12, padding: "20px 24px", boxShadow: "0 4px 24px rgba(0,212,170,0.05)", transition: "transform 0.2s", cursor: "default" }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "2px", color: "#4a5568", textTransform: "uppercase", marginBottom: 16 }}>Overall Fraud Risk Score</div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg width="240" height="140" viewBox="0 0 240 140">
          <defs>
            <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00d4aa" /><stop offset="40%" stopColor="#00d4aa" />
              <stop offset="50%" stopColor="#ffa502" /><stop offset="70%" stopColor="#ffa502" />
              <stop offset="80%" stopColor="#ff4757" /><stop offset="100%" stopColor="#ff4757" />
            </linearGradient>
          </defs>
          <path d={`M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`} fill="none" stroke="#1a2744" strokeWidth="18" strokeLinecap="round" />
          <path d={`M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`} fill="none" stroke="url(#gaugeGrad)" strokeWidth="18" strokeLinecap="round" strokeDasharray={`${(clamp / 100) * Math.PI * r} ${Math.PI * r}`} style={{ transition: "stroke-dasharray 1.5s ease-out" }} />
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="3" strokeLinecap="round" style={{ transition: "all 1.5s ease-out", filter: `drop-shadow(0 0 6px ${color})` }} />
          <circle cx={cx} cy={cy} r="6" fill={color} style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "fill 1.5s" }} />
          <text x={cx} y={cy - 15} textAnchor="middle" fill="#e8ecf4" fontSize="28" fontWeight="900">{Math.round(clamp)}</text>
          <text x={cx} y={cy + 5} textAnchor="middle" fill={color} fontSize="9" fontWeight="800" letterSpacing="2">{label}</text>
        </svg>
      </div>
    </div>
  );
}

/* ═══════ FEATURE 3 — Sparkline ═══════ */
export function Sparkline({ data, color = "#00d4aa", width = 100, height = 40 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({ x: (i / Math.max(data.length - 1, 1)) * width, y: height - ((v - min) / range) * (height - 4) - 2 }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${d} L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg width={width} height={height} style={{ overflow: "visible", opacity: 0.7 }}>
      <defs><linearGradient id={`sp-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={areaD} fill={`url(#sp-${color.replace("#","")})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ═══════ FEATURE 7 — Animated Donut Chart ═══════ */
const DONUT_COLORS: Record<string, string> = { WARRANTY: "#00d4aa", PAID: "#0088ff", CAMPAIGN: "#a855f7", GOODWILL: "#ffa502", UNKNOWN: "#4a5568" };
export function DonutChart({ data }: { data: { label: string; value: number }[] }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 200); return () => clearTimeout(t); }, []);
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = 70, cx = 90, cy = 90, sw = 22;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const countVal = useCountUp(total, 1500, show);

  return (
    <div style={{ background: "#0d1526", border: "0.5px solid #1a2744", borderRadius: 12, padding: "20px 24px", boxShadow: "0 4px 24px rgba(0,212,170,0.05)" }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "2px", color: "#4a5568", textTransform: "uppercase", marginBottom: 16 }}>Ticket Category Distribution</div>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <svg width="180" height="180" viewBox="0 0 180 180">
          {data.filter(d => d.value > 0).map((d, i) => {
            const pct = d.value / total;
            const dashLen = pct * circ;
            const seg = (
              <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={DONUT_COLORS[d.label] || "#4a5568"} strokeWidth={sw}
                strokeDasharray={`${dashLen} ${circ - dashLen}`} strokeDashoffset={-offset}
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{ transition: show ? "stroke-dasharray 1.5s ease-out, stroke-dashoffset 1.5s ease-out" : "none", opacity: show ? 1 : 0 }} />
            );
            offset += dashLen;
            return seg;
          })}
          <text x={cx} y={cy - 4} textAnchor="middle" fill="#e8ecf4" fontSize="22" fontWeight="900">{countVal}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fill="#4a5568" fontSize="8" fontWeight="700" letterSpacing="1">TOTAL</text>
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.filter(d => d.value > 0).map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: DONUT_COLORS[d.label] || "#4a5568", flexShrink: 0 }} />
              <span style={{ color: "#a0aec0", fontWeight: 600 }}>{d.label}</span>
              <span style={{ color: "#e8ecf4", fontWeight: 800, marginLeft: "auto" }}>{d.value}</span>
              <span style={{ color: "#4a5568", fontWeight: 600 }}>{Math.round((d.value / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════ FEATURE 5 — Manufacturer Leaderboard ═══════ */
export function ManufacturerBoard({ data }: { data: [string, number][] }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 300); return () => clearTimeout(t); }, []);
  const maxCount = data[0]?.[1] || 1;
  const total = data.reduce((a, d) => a + d[1], 0) || 1;
  const barColors = ["#00d4aa", "#0088ff", "#a855f7", "#ffa502", "#ff4757", "#06b6d4", "#ec4899", "#84cc16"];

  return (
    <div style={{ background: "#0d1526", border: "0.5px solid #1a2744", borderRadius: 12, padding: "20px 24px", boxShadow: "0 4px 24px rgba(0,212,170,0.05)" }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "2px", color: "#4a5568", textTransform: "uppercase", marginBottom: 16 }}>Top Vehicle Manufacturers</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.slice(0, 8).map(([name, count], i) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, transition: "transform 0.2s", cursor: "default" }}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateX(4px)")} onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: barColors[i % barColors.length] + "20", border: `1px solid ${barColors[i % barColors.length]}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: barColors[i % barColors.length], flexShrink: 0 }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#e8ecf4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#4a5568", flexShrink: 0, marginLeft: 8 }}>{Math.round((count / total) * 100)}%</span>
              </div>
              <div style={{ height: 6, background: "#1a2744", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${barColors[i % barColors.length]}, ${barColors[i % barColors.length]}80)`, width: show ? `${(count / maxCount) * 100}%` : "0%", transition: `width 1s ease-out ${i * 100}ms` }} />
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 900, color: barColors[i % barColors.length], minWidth: 24, textAlign: "right" }}>{count}</span>
          </div>
        ))}
        {data.length === 0 && <div style={{ fontSize: 10, color: "#4a5568", textAlign: "center", padding: 20 }}>No manufacturer data yet</div>}
      </div>
    </div>
  );
}

/* ═══════ FEATURE 8 — Verification Timeline ═══════ */
interface TimelineItem { filename: string; verdict: string; category: string; time: string; }
export function VerificationTimeline({ items }: { items: TimelineItem[] }) {
  const vColor = (v: string) => v === "accepted" || v === "clean" ? "#00d4aa" : v === "rejected" || v === "invalid" ? "#ff4757" : "#ffa502";
  return (
    <div style={{ background: "#0d1526", border: "0.5px solid #1a2744", borderRadius: 12, padding: "20px 24px", boxShadow: "0 4px 24px rgba(0,212,170,0.05)", maxHeight: 480, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "2px", color: "#4a5568", textTransform: "uppercase" }}>Recent Verifications</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d4aa", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 8, fontWeight: 800, color: "#00d4aa", letterSpacing: "1px" }}>LIVE</span>
        </span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
        {items.length === 0 && <div style={{ fontSize: 10, color: "#4a5568", textAlign: "center", padding: 30 }}>No events yet</div>}
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: 4, animation: `fadeSlideIn 0.3s ease ${i * 50}ms both` }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: vColor(item.verdict), boxShadow: `0 0 8px ${vColor(item.verdict)}60` }} />
              {i < items.length - 1 && <div style={{ width: 1, flex: 1, background: "linear-gradient(to bottom, #1a274480, #1a274410)", minHeight: 30 }} />}
            </div>
            <div style={{ paddingBottom: 16, flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#e8ecf4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.filename}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: vColor(item.verdict) + "15", color: vColor(item.verdict), textTransform: "uppercase" }}>{item.verdict}</span>
                {item.category && <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#1a2744", color: "#4a5568" }}>{item.category}</span>}
              </div>
              <div style={{ fontSize: 9, color: "#4a556880", marginTop: 4 }}>{item.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════ FEATURE 9 — Fraud Activity Calendar ═══════ */
export function FraudCalendar({ dayCounts }: { dayCounts: Record<string, number> }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 400); return () => clearTimeout(t); }, []);
  const today = new Date();
  const days: { date: string; count: number; col: number; row: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    const col = Math.floor((89 - i) / 7);
    const row = d.getDay();
    days.push({ date: ds, count: dayCounts[ds] || 0, col, row });
  }
  const cellColor = (c: number) => c === 0 ? "#1a2744" : c <= 2 ? "#0d4f3c" : c <= 5 ? "#f39c12" : "#ff4757";
  const months = Array.from(new Set(days.map(d => d.date.substring(0, 7)))).map(m => {
    const idx = days.findIndex(d => d.date.startsWith(m));
    return { label: new Date(m + "-01").toLocaleDateString("en", { month: "short" }), col: days[idx]?.col || 0 };
  });

  return (
    <div style={{ background: "#0d1526", border: "0.5px solid #1a2744", borderRadius: 12, padding: "20px 24px", boxShadow: "0 4px 24px rgba(0,212,170,0.05)" }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "2px", color: "#4a5568", textTransform: "uppercase", marginBottom: 16 }}>Fraud Activity — Last 90 Days</div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ position: "relative", paddingTop: 16, paddingLeft: 28 }}>
          {months.map((m, i) => <span key={i} style={{ position: "absolute", top: 0, left: 28 + m.col * 14, fontSize: 9, color: "#4a5568", fontWeight: 700 }}>{m.label}</span>)}
          {["Mon", "", "Wed", "", "Fri", "", ""].map((l, i) => l && <span key={i} style={{ position: "absolute", left: 0, top: 16 + i * 14, fontSize: 8, color: "#4a556860", fontWeight: 600, lineHeight: "12px" }}>{l}</span>)}
          <div style={{ display: "flex", gap: 2 }}>
            {Array.from({ length: Math.ceil(days.length / 7) }).map((_, col) => (
              <div key={col} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {Array.from({ length: 7 }).map((_, row) => {
                  const d = days.find(dd => dd.col === col && dd.row === row);
                  return (
                    <div key={row} title={d ? `${d.date}: ${d.count} fraud` : ""} style={{
                      width: 10, height: 10, borderRadius: 2, background: d ? cellColor(d.count) : "transparent",
                      opacity: show ? 1 : 0, transition: `opacity 0.3s ease ${(col * 7 + row) * 5}ms`,
                      cursor: d ? "pointer" : "default"
                    }} />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
        <span style={{ fontSize: 8, color: "#4a5568" }}>Less</span>
        {[0, 1, 3, 6].map(v => <div key={v} style={{ width: 10, height: 10, borderRadius: 2, background: cellColor(v) }} />)}
        <span style={{ fontSize: 8, color: "#4a5568" }}>More</span>
      </div>
    </div>
  );
}

/* ═══════ FEATURE 2 — Live Document Feed Ticker ═══════ */
interface TickerItem { filename: string; verdict: string; timeAgo: string; }
export function LiveTicker({ items }: { items: TickerItem[] }) {
  if (!items.length) return null;
  const doubled = [...items, ...items];
  const vColor = (v: string) => v === "accepted" || v === "clean" ? "#00d4aa" : v === "rejected" || v === "invalid" ? "#ff4757" : "#ffa502";
  return (
    <div style={{ background: "#0d1526", borderTop: "2px solid #00d4aa", overflow: "hidden", padding: "8px 0", marginBottom: 24, borderRadius: "0 0 8px 8px" }}>
      <div className="ticker-scroll" style={{ display: "flex", gap: 0, whiteSpace: "nowrap", width: "max-content" }}>
        {doubled.map((item, i) => (
          <React.Fragment key={i}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 16px", flexShrink: 0 }}>
              <FileText size={12} color="#4a5568" />
              <span style={{ fontSize: 10, fontWeight: 600, color: "#a0aec0" }}>{item.filename}</span>
              <span style={{ fontSize: 8, fontWeight: 800, padding: "1px 6px", borderRadius: 3, background: vColor(item.verdict) + "20", color: vColor(item.verdict), textTransform: "uppercase" }}>{item.verdict}</span>
              <span style={{ fontSize: 8, color: "#4a556860" }}>{item.timeAgo}</span>
            </div>
            <span style={{ color: "#00d4aa40", fontSize: 8, display: "inline-flex", alignItems: "center", padding: "0 4px" }}>●</span>
          </React.Fragment>
        ))}
      </div>
      <style>{`
        .ticker-scroll { animation: tickerScroll 30s linear infinite; }
        .ticker-scroll:hover { animation-play-state: paused; }
        @keyframes tickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
