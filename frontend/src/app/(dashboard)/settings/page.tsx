"use client";

import { useState, useEffect } from "react";
import { Server, Layout, Database, AlertCircle, Save, Check } from "lucide-react";

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'engine' | 'appearance' | 'storage'>('engine');
    const [saved, setSaved] = useState(false);
    const [settings, setSettings] = useState({
        defaultMode: 'single',
        autoExportCsv: false,
        uiDensity: 'comfortable',
        enableAnimations: true,
        retentionConfig: '30'
    });

    useEffect(() => {
        const stored = localStorage.getItem('verentis_settings');
        if (stored) {
            try { setSettings(JSON.parse(stored)); } catch (e) { }
        }
    }, []);

    const handleChange = (key: string, val: any) => {
        setSettings(s => ({ ...s, [key]: val }));
    };

    const handleSave = () => {
        localStorage.setItem('verentis_settings', JSON.stringify(settings));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const clearAnalytics = () => {
        if (window.confirm("WARNING: This will permanently delete all forensic analytics data from this browser. Continue?")) {
            localStorage.removeItem('verentis_analytics');
            alert("Analytics cache cleared.");
        }
    };

    return (
        <div className="flex h-full bg-[#0a0d14] text-[#e8ecf4]">
            {/* Sidebar */}
            <div className="w-64 border-r border-[#1e2535] bg-[#0d101a] p-6 flex flex-col pt-12 shrink-0">
                <h2 className="text-[10px] font-black uppercase tracking-[2px] text-[#4a5568] mb-6">SETTINGS CATEGORIES</h2>
                <nav className="space-y-2 flex-1">
                    <button onClick={() => setActiveTab('engine')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${activeTab === 'engine' ? 'bg-[#00c2cb10] text-[#00c2cb] border border-[#00c2cb30]' : 'text-[#4a5568] hover:bg-[#1e2535] hover:text-[#e8ecf4]'}`}>
                        <Server className="w-4 h-4" /> Processing Engine
                    </button>
                    <button onClick={() => setActiveTab('appearance')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${activeTab === 'appearance' ? 'bg-[#00c2cb10] text-[#00c2cb] border border-[#00c2cb30]' : 'text-[#4a5568] hover:bg-[#1e2535] hover:text-[#e8ecf4]'}`}>
                        <Layout className="w-4 h-4" /> Appearance
                    </button>
                    <button onClick={() => setActiveTab('storage')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${activeTab === 'storage' ? 'bg-[#00c2cb10] text-[#00c2cb] border border-[#00c2cb30]' : 'text-[#4a5568] hover:bg-[#1e2535] hover:text-[#e8ecf4]'}`}>
                        <Database className="w-4 h-4" /> Storage & Advanced
                    </button>
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-12 max-w-4xl relative overflow-y-auto pt-16">

                <div className="flex items-center justify-between mb-10 pb-6 border-b border-[#1e2535]">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-[#e8ecf4] flex items-center gap-3">
                            Configuration
                        </h1>
                        <p className="text-[#4a5568] mt-2 text-sm font-medium">Manage your local forensic system preferences and data.</p>
                    </div>
                    <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 bg-[#00c2cb] hover:bg-[#00e6f0] text-[#0a0d14] font-bold rounded-lg shadow-[0_0_20px_rgba(0,194,203,0.3)] transition-all">
                        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />} {saved ? 'Saved' : 'Save Changes'}
                    </button>
                </div>

                <div className="space-y-8 pb-32">
                    {/* ENGINE SETTINGS */}
                    {activeTab === 'engine' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h3 className="text-lg font-bold text-[#e8ecf4] mb-6 flex items-center gap-2"><Server className="w-5 h-5 text-[#00c2cb]" /> Processing Engine Preferences</h3>

                            <div className="bg-[#10131c] border border-[#1e2535] rounded-xl p-6 space-y-8">
                                <div className="space-y-3 flex justify-between items-start">
                                    <div className="max-w-md">
                                        <label className="text-sm font-bold text-[#e8ecf4]">Default Startup Mode</label>
                                        <p className="text-xs text-[#4a5568] mt-1">Select which analysis mode is active when opening the dashboard.</p>
                                    </div>
                                    <div className="flex bg-[#0a0d14] p-1 rounded-lg border border-[#1e2535]">
                                        <button onClick={() => handleChange('defaultMode', 'single')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${settings.defaultMode === 'single' ? 'bg-[#1e2535] text-[#e8ecf4]' : 'text-[#4a5568] hover:text-[#e8ecf4]'}`}>Single Document</button>
                                        <button onClick={() => handleChange('defaultMode', 'batch')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${settings.defaultMode === 'batch' ? 'bg-[#1e2535] text-[#e8ecf4]' : 'text-[#4a5568] hover:text-[#e8ecf4]'}`}>Batch Folder</button>
                                    </div>
                                </div>
                                <hr className="border-[#1e2535]" />
                                <div className="space-y-3 flex justify-between items-start">
                                    <div className="max-w-md">
                                        <label className="text-sm font-bold text-[#e8ecf4]">Auto-export Batch CSV</label>
                                        <p className="text-xs text-[#4a5568] mt-1">Automatically download a CSV of the results when a batch analysis completes.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer mt-2">
                                        <input type="checkbox" className="sr-only peer" checked={settings.autoExportCsv} onChange={(e) => handleChange('autoExportCsv', e.target.checked)} />
                                        <div className="w-11 h-6 bg-[#1e2535] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#4a5568] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00c2cb] peer-checked:after:bg-white"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* APPEARANCE SETTINGS */}
                    {activeTab === 'appearance' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h3 className="text-lg font-bold text-[#e8ecf4] mb-6 flex items-center gap-2"><Layout className="w-5 h-5 text-[#00c2cb]" /> Interface Appearance</h3>

                            <div className="bg-[#10131c] border border-[#1e2535] rounded-xl p-6 space-y-8">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-[#e8ecf4]">UI Density</label>
                                    <p className="text-xs text-[#4a5568] mt-1 mb-4">Control the spacing and padding across data tables and result cards.</p>
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <button onClick={() => handleChange('uiDensity', 'comfortable')} className={`p-4 border rounded-xl text-left transition-all ${settings.uiDensity === 'comfortable' ? 'border-[#00c2cb] bg-[#00c2cb10]' : 'border-[#1e2535] bg-[#0a0d14] hover:border-[#4a5568]'}`}>
                                            <div className="font-bold text-sm text-[#e8ecf4]">Comfortable</div>
                                            <div className="text-xs text-[#4a5568] mt-1">Standard padding, ideal for large monitors and easier reading.</div>
                                        </button>
                                        <button onClick={() => handleChange('uiDensity', 'compact')} className={`p-4 border rounded-xl text-left transition-all ${settings.uiDensity === 'compact' ? 'border-[#00c2cb] bg-[#00c2cb10]' : 'border-[#1e2535] bg-[#0a0d14] hover:border-[#4a5568]'}`}>
                                            <div className="font-bold text-sm text-[#e8ecf4]">Compact</div>
                                            <div className="text-xs text-[#4a5568] mt-1">Reduced spacing to fit more rows and data onto the screen without scrolling.</div>
                                        </button>
                                    </div>
                                </div>
                                <hr className="border-[#1e2535]" />
                                <div className="space-y-3 flex justify-between items-start">
                                    <div className="max-w-md">
                                        <label className="text-sm font-bold text-[#e8ecf4]">Enable Live Scan Micro-Animations</label>
                                        <p className="text-xs text-[#4a5568] mt-1">Show real-time scanning lasers, confidence ring draw-ins, and animated number counting.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer mt-2">
                                        <input type="checkbox" className="sr-only peer" checked={settings.enableAnimations} onChange={(e) => handleChange('enableAnimations', e.target.checked)} />
                                        <div className="w-11 h-6 bg-[#1e2535] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#4a5568] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00c2cb] peer-checked:after:bg-white"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STORAGE & ADVANCED SETTINGS */}
                    {activeTab === 'storage' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h3 className="text-lg font-bold text-[#e8ecf4] mb-6 flex items-center gap-2"><Database className="w-5 h-5 text-[#00c2cb]" /> Data & Storage</h3>

                            <div className="bg-[#10131c] border border-[#1e2535] rounded-xl p-6 space-y-8">
                                <div className="space-y-3 flex justify-between items-center">
                                    <div className="max-w-md">
                                        <label className="text-sm font-bold text-[#e8ecf4]">Analytics Retention Strategy</label>
                                        <p className="text-xs text-[#4a5568] mt-1">Determine how long forensic telemetry logs are persisted in your local cache before auto-deletion.</p>
                                    </div>
                                    <select value={settings.retentionConfig} onChange={e => handleChange('retentionConfig', e.target.value)} className="bg-[#0a0d14] border border-[#1e2535] text-[#e8ecf4] text-sm rounded-lg focus:ring-[#00c2cb] focus:border-[#00c2cb] block p-2.5 outline-none">
                                        <option value="7">7 Days retention</option>
                                        <option value="30">30 Days retention</option>
                                        <option value="90">90 Days retention</option>
                                        <option value="all">Save forever (Not recommended)</option>
                                    </select>
                                </div>
                                <hr className="border-[#1e2535]" />
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-[#ff1744] mt-0.5 shrink-0" />
                                        <div>
                                            <label className="text-sm font-bold text-[#ff1744]">Danger Zone: Clear Local Analytics</label>
                                            <p className="text-xs text-[#4a5568] mt-1">Executing this action will instantly eradicate all localized dashboard activity timelines, charts, and historical metrics. This does not affect remote OCR records.</p>
                                        </div>
                                    </div>
                                    <button onClick={clearAnalytics} className="mt-4 px-6 py-2.5 bg-[transparent] hover:bg-[#ff1744] border border-[#ff1744] text-[#ff1744] hover:text-white font-bold text-xs uppercase tracking-widest rounded-lg transition-all">
                                        Wipe Local Analytics
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
