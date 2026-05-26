"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { cn } from "@/lib/utils";
import { Shield, Activity, FileText, Clipboard, BarChart, Settings as SettingsIcon, LogOut, Search, X } from "lucide-react";
import { NotificationProvider, useNotifications } from "@/context/NotificationContext";

function CommandPalette({ open, setOpen, router }: { open: boolean, setOpen: any, router: any }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState("");
    const [selIdx, setSelIdx] = useState(0);
    const actions = [
        { label: 'Threat Intelligence', path: '/threat-intelligence', icon: <Activity className="w-4 h-4" /> },
        { label: 'Document Analysis (Live Scan)', path: '/document-analysis', icon: <FileText className="w-4 h-4" /> },
        { label: 'Audit Logs', path: '/audit-logs', icon: <Clipboard className="w-4 h-4" /> },
        { label: 'Analytics Hub', path: '/dashboard', icon: <BarChart className="w-4 h-4" /> },
        { label: 'System Settings', path: '/settings', icon: <SettingsIcon className="w-4 h-4" /> },
    ];
    const filtered = actions.filter(a => a.label.toLowerCase().includes(query.toLowerCase()));

    useEffect(() => { setSelIdx(0); }, [query]);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 50);
        else setQuery("");
    }, [open]);

    useEffect(() => {
        const handleDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen((o: boolean) => !o);
            }
            if (!open) return;
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx(s => (s + 1) % (filtered.length || 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSelIdx(s => (s - 1 + filtered.length) % (filtered.length || 1)); }
            if (e.key === 'Enter') { e.preventDefault(); if (filtered[selIdx]) { router.push(filtered[selIdx].path); setOpen(false); } }
        };
        window.addEventListener('keydown', handleDown);
        return () => window.removeEventListener('keydown', handleDown);
    }, [open, setOpen, filtered, selIdx, router]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh]">
            <div className="bg-[#10131c] border border-[#1e2535] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-full max-w-[600px] overflow-hidden transform transition-all flex flex-col" style={{ animation: 'paletteIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)', maxHeight: '70vh' }}>
                <div className="flex items-center px-4 py-3 border-b border-[#1e2535]">
                    <Search className="w-5 h-5 text-[#00c2cb]" />
                    <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} className="flex-1 bg-transparent border-none text-[#e8ecf4] px-4 py-2 focus:outline-none placeholder:text-[#4a5568] focus:ring-0" placeholder="Type a command or search..." />
                    <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[#1e2535] text-[#4a5568]"><X className="w-5 h-5" /></button>
                </div>
                <div className="overflow-y-auto p-2 flex-1 relative">
                    {filtered.length === 0 ? (
                        <div className="p-8 text-center text-[#4a5568] text-sm">No results found for "{query}".</div>
                    ) : (
                        filtered.map((action, i) => (
                            <button key={action.path} onClick={() => { router.push(action.path); setOpen(false); }} onMouseEnter={() => setSelIdx(i)} className={`w-full flex items-center justify-between p-3 rounded-lg group transition-colors text-left ${i === selIdx ? 'bg-[#1e2535]' : 'hover:bg-[#1a1f30]'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={i === selIdx ? "text-[#00c2cb]" : "text-[#4a5568]"}>{action.icon}</div>
                                    <span className={i === selIdx ? "text-[#00c2cb] text-sm font-bold" : "text-[#e8ecf4] text-sm font-medium"}>{action.label}</span>
                                </div>
                                <span className={`text-[10px] uppercase font-bold text-[#00c2cb] transition-opacity ${i === selIdx ? 'opacity-100' : 'opacity-0'}`}>Jump ⏎</span>
                            </button>
                        ))
                    )}
                </div>
                <div className="p-3 bg-[#0a0d14] border-t border-[#1e2535] flex justify-between items-center text-[10px] text-[#4a5568] shrink-0">
                    <span><kbd className="bg-[#1e2535] px-1.5 py-0.5 rounded mr-1 leading-none font-sans border border-[#2d3748]">↑↓</kbd> to navigate</span>
                    <span><kbd className="bg-[#1e2535] px-1.5 py-0.5 rounded mr-1 leading-none font-sans border border-[#2d3748]">⏎</kbd> to select</span>
                    <span><kbd className="bg-[#1e2535] px-1.5 py-0.5 rounded mr-1 leading-none font-sans border border-[#2d3748]">esc</kbd> to close</span>
                </div>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes paletteIn { from { opacity: 0; transform: scale(0.95) translateY(-10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                `}} />
            </div>
            <div className="absolute inset-0 -z-10" onClick={() => setOpen(false)} />
        </div>
    );
}

// ─── Global Onboarding Tour ────────────────────────────────────
const TOUR_STEPS = [
    {
        title: 'Welcome to Verentis',
        body: 'The Forensic Detection Intelligence platform — an AI-powered suite for Automotive and Ticket validation document verification.',
        step: 1
    },
    {
        title: 'Threat Intelligence Hub',
        body: 'Your command center showing live forensic trends, session data, and detection signals in real time.',
        step: 2
    },
    {
        title: 'Document Analysis',
        body: 'Upload Vehicle or Ticket documents for multi-spectral forensic analysis and instant verdicts.',
        step: 3
    },
    {
        title: 'Forensic Audit Trail',
        body: 'Every scan is logged to a secure chain of custody ledger. Review hash-verified evidence profiles anytime.',
        step: 4
    },
];

function GlobalTour() {
    const { addNotification } = useNotifications();
    const [step, setStep] = useState(() => {
        if (typeof window === 'undefined') return -1;
        return !localStorage.getItem('verentis_toured') ? 0 : -1;
    });

    if (step < 0) return null;

    const current = TOUR_STEPS[step];

    const advance = () => {
        if (step < TOUR_STEPS.length - 1) {
            setStep(step + 1);
        } else {
            setStep(-1);
            localStorage.setItem('verentis_toured', 'true');
            addNotification('info', 'Tour Complete', 'Welcome aboard. You are ready to run your first forensic investigation.');
        }
    };

    const dismiss = () => {
        setStep(-1);
        localStorage.setItem('verentis_toured', 'true');
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-[#10131c] border border-[#00c2cb40] rounded-3xl p-8 shadow-[0_0_80px_rgba(0,194,203,0.2)] relative overflow-hidden">
                {/* Ambient glow */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#00c2cb] opacity-5 rounded-full blur-[60px] pointer-events-none" />

                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-6">
                    {TOUR_STEPS.map((_, i) => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-all duration-500" style={{
                            backgroundColor: i <= step ? '#00c2cb' : '#1e2535'
                        }} />
                    ))}
                </div>

                <div className="text-[9px] font-black uppercase tracking-[0.3em] text-[#00c2cb] mb-3">
                    Step {current.step} of {TOUR_STEPS.length}
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white mb-3">{current.title}</h2>
                <p className="text-sm text-[#c8d0e0] leading-relaxed mb-8 font-medium">{current.body}</p>

                <div className="flex items-center justify-between">
                    <button
                        onClick={dismiss}
                        className="text-[10px] font-black uppercase tracking-widest text-[#4a5568] hover:text-[#e8ecf4] transition-colors"
                    >
                        Skip Tour
                    </button>
                    <button
                        onClick={advance}
                        className="px-6 py-3 bg-[#00c2cb] hover:bg-[#00d4de] text-[#0a0d14] rounded-xl text-[11px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(0,194,203,0.3)]"
                    >
                        {step < TOUR_STEPS.length - 1 ? 'Next →' : 'Get Started'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <NotificationProvider>
            <DashboardContent>{children}</DashboardContent>
        </NotificationProvider>
    );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
    const [cmdOpen, setCmdOpen] = useState(false);
    const { notifications, showNotifs, setShowNotifs, markAllRead } = useNotifications();

    const router = useRouter();

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.push("/login");
    };

    // ── Auth guard: redirect to login if no token ────────────────
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.replace("/login");
        }
    }, [pathname, router]);

    // ── Load persisted user profile ─────────────────────────────
    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const navItems = [
        { name: "Threat Intelligence", icon: <Activity className="w-4 h-4" />, path: "/threat-intelligence" },
        { name: "Document Analysis", icon: <FileText className="w-4 h-4" />, path: "/document-analysis" },
        { name: "Audit Logs", icon: <Clipboard className="w-4 h-4" />, path: "/audit-logs" },
        { name: "Analytics Hub", icon: <BarChart className="w-4 h-4" />, path: "/dashboard" },
        { name: "Settings", icon: <SettingsIcon className="w-4 h-4" />, path: "/settings" },
    ];

    return (
        <div className="flex h-screen overflow-hidden bg-background text-foreground font-display">
            {/* Global Onboarding Tour */}
            <GlobalTour />
            {/* Sidebar */}
            <aside className="w-[220px] bg-[#10131c] border-r border-[#1e2535] flex flex-col z-20 shrink-0">
                <div className="p-6 flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#00c2cb] rounded-lg flex items-center justify-center">
                        <Shield className="w-5 h-5 text-[#0a0d14]" />
                    </div>
                    <h1 className="text-xl font-black tracking-tighter uppercase text-[#e8ecf4]">Verentis</h1>
                </div>

                <nav className="flex-1 px-4 py-4 space-y-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            href={item.path}
                            id={item.path === '/dashboard' ? 'sidebar-reports' : undefined}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group",
                                pathname === item.path
                                    ? "bg-[#00c2cb15] text-[#00c2cb] border border-[#00c2cb30]"
                                    : "text-[#4a5568] hover:text-[#e8ecf4] hover:bg-[#1e2535]"
                            )}
                        >
                            <span className={cn(
                                "transition-transform group-hover:scale-110",
                                pathname === item.path ? "text-[#00c2cb]" : "text-inherit"
                            )}>
                                {item.icon}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest">{item.name}</span>
                        </Link>
                    ))}
                </nav>

                <div className="p-4 mt-auto border-t border-border">
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border">
                            <img alt="User Profile" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDYGXH-Y7qM6B0WrOgdEAIraa0uEGdrMvyif3YpJSxV6vOkoGxJDav8Bg7F8ZuRK0_i305calXJkPaKmOJulIhDDZuNdwquSrrKl0K6vhkesqe_C3Htgp8lpMeR-LsF3qYDDrP13xGCq10xfnIQSAv0pPz4RMdBUS72-HSUVOSk5NwLsLBVKiKxk1dg1o6D_B4aSiBCYFmmybkwWCxqB2A4BArHSaMjah6U6W_n_NxgASZYEKfxEr2j61RgkYbzNQYi_fI1lbi-dfs" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{user?.full_name || "Jameson Carter"}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{user?.email || "Chief Forensic Officer"}</p>
                        </div>
                        <span className="material-symbols-outlined text-muted-foreground text-sm">unfold_more</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="mt-2 w-full flex items-center gap-3 p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer group"
                    >
                        <span className="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">logout</span>
                        <span className="text-xs font-bold uppercase tracking-widest">Sign Out</span>
                    </button>
                    <div className="mt-4 pt-4 border-t border-border flex justify-center">
                        <ThemeSwitcher />
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 bg-card/80 backdrop-blur-sm border-b border-border px-8 flex items-center justify-between sticky top-0 z-10 shrink-0">
                    <div>
                        <h2 className="text-sm font-black text-[#e8ecf4] uppercase tracking-[0.2em]">
                            FORENSIC SERVICES
                        </h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative hidden md:block">
                            <button onClick={() => setCmdOpen(true)} className="flex items-center justify-between w-64 px-4 py-2 bg-[#10131c] border border-[#1e2535] rounded-full text-xs text-[#4a5568] hover:border-[#00c2cb] hover:text-[#e8ecf4] transition-colors focus:outline-none">
                                <span className="flex items-center gap-2"><Search className="w-3.5 h-3.5" /> Quick search...</span>
                                <kbd className="hidden sm:inline-block bg-[#1e2535] px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold border border-[#2d3748]">Ctrl K</kbd>
                            </button>
                        </div>
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifs(!showNotifs)}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-[#10131c] border border-[#1e2535] text-[#4a5568] hover:border-[#00c2cb] hover:text-[#e8ecf4] relative transition-all"
                            >
                                <span className="material-symbols-outlined text-xl">notifications</span>
                                {notifications.filter(n => !n.read).length > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#ff1744] rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-[0_0_10px_rgba(255,23,68,0.5)]">
                                        {notifications.filter(n => !n.read).length}
                                    </span>
                                )}
                            </button>

                            {showNotifs && (
                                <div
                                    className="absolute top-full right-0 mt-4 w-80 bg-[#10131c] border border-[#1e2535] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[1000] overflow-hidden"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="p-4 border-b border-[#1e2535] flex justify-between items-center bg-[#0a0d14]">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-[#e8ecf4]">Notifications</span>
                                        <button onClick={markAllRead} className="text-[10px] font-bold text-[#00c2cb] hover:underline">Mark all read</button>
                                    </div>
                                    <div className="max-h-[400px] overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="p-10 text-center text-[#4a5568] text-xs font-medium italic">
                                                No new notifications
                                            </div>
                                        ) : (
                                            notifications.map(n => (
                                                <div key={n.id} className={cn("p-4 border-b border-[#1e2535] flex gap-3 transition-colors", !n.read ? "bg-[#00c2cb05]" : "hover:bg-[#1e253530]")}>
                                                    <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0 shadow-[0_0_8px_currentColor]",
                                                        n.type === 'success' ? "text-[#00c853] bg-[#00c853]" :
                                                            n.type === 'error' ? "text-[#ff1744] bg-[#ff1744]" :
                                                                n.type === 'warning' ? "text-[#ffab00] bg-[#ffab00]" : "text-[#0088ff] bg-[#0088ff]"
                                                    )} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-bold text-[#e8ecf4] truncate">{n.title}</p>
                                                        <p className="text-[10px] text-[#4a5568] mt-1 leading-relaxed">{n.body}</p>
                                                        <p className="text-[8px] text-[#2d3748] mt-2 font-mono uppercase tracking-tighter">{n.time}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto" onClick={() => setShowNotifs(false)}>
                    <CommandPalette open={cmdOpen} setOpen={setCmdOpen} router={router} />
                    {children}

                    <footer className="mt-auto py-6 px-8 border-t border-border flex justify-between items-center bg-card shrink-0">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">© 2024 Verentis Forensic Division</p>
                        <div className="flex gap-6">
                            <a className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest hover:text-primary" href="#">Documentation</a>
                            <a className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest hover:text-primary" href="#">Forensic API</a>
                            <a className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest hover:text-primary" href="#">Legal</a>
                        </div>
                    </footer>
                </div>
            </main>
        </div>
    );
}
