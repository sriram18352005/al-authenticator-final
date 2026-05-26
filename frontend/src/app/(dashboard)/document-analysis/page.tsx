"use client";

import { useState } from "react";
import { Car, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { VehicleModule } from "@/components/forensics/VehicleModule";
import { TicketValidationModule } from "@/components/forensics/TicketValidationModule";

export default function AnalysisPage() {
    const [activeTab, setActiveTab] = useState<"vehicle" | "ticket">("vehicle");

    const tabs = [
        { id: "vehicle", label: "Vehicle", icon: <Car className="w-4 h-4" /> },
        { id: "ticket", label: "Ticket Validation", icon: <Ticket className="w-4 h-4" /> },
    ] as const;

    return (
        <div className="min-h-full bg-[#0a0d14] text-[#e8ecf4] p-8">
            <div className="max-w-[1200px] mx-auto space-y-8">

                {/* Tab Switcher */}
                <div className="flex justify-end">
                    <div className="flex bg-[#10131c] p-1.5 rounded-2xl border border-[#1e2535] shadow-2xl">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={cn(
                                    "flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300 tracking-tight",
                                    activeTab === tab.id
                                        ? tab.id === "ticket"
                                            ? "bg-[#00c2cb] text-[#050810] shadow-[0_0_20px_rgba(0,194,203,0.4)] scale-[1.02]"
                                            : "bg-[#00aaff] text-white shadow-[0_0_20px_rgba(0,170,255,0.3)] scale-[1.02]"
                                        : "text-[#4a5568] hover:text-[#e8ecf4] hover:bg-[#1e2535]"
                                )}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Module Rendering */}
                <div className="min-h-[600px]">
                    {activeTab === "vehicle" && <VehicleModule />}
                    {activeTab === "ticket" && <TicketValidationModule />}
                </div>

            </div>
        </div>
    );
}
