"use client";

import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { Explainability } from "@/components/Explainability";
import { WhyVerentis } from "@/components/WhyVerentis";

export default function Home() {
    return (
        <main className="min-h-screen bg-[#050810]">
            <Navbar />
            <Hero />
            <Features />
            <WhyVerentis />
            <Explainability />
        </main>
    );
}
