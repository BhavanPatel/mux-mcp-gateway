"use client";

import dynamic from "next/dynamic";
import Reveal from "../components/Reveal";
import Hero from "../components/Hero";
import Problem from "../components/Problem";
import Solution from "../components/Solution";
import Architecture from "../components/Architecture";
import Features from "../components/Features";
import Tools from "../components/Tools";
import CLI from "../components/CLI";
import Auth from "../components/Auth";
import Config from "../components/Config";
import Lifecycle from "../components/Lifecycle";
import Install from "../components/Install";
import Comparison from "../components/Comparison";
import TechStack from "../components/TechStack";
import Clients from "../components/Clients";
import Footer from "../components/Footer";
import StickyNav from "../components/StickyNav";

const Galaxy = dynamic(() => import("../components/Galaxy"), { ssr: false });

export default function Home() {
  return (
    <main className="relative">
      {/* Galaxy starfield background — darkened overlay for readability */}
      <div className="fixed inset-0 z-0">
        <Galaxy />
        <div className="absolute inset-0" style={{ background: 'rgba(5,5,16,0.65)', backdropFilter: 'blur(1px)' }} />
      </div>
      <div className="relative z-10">
        <StickyNav />
        <section className="h-screen flex items-center justify-center">
          <Hero />
        </section>
        <Reveal><Problem /></Reveal>
        <Reveal delay={0.1}><Solution /></Reveal>
        <Reveal><Architecture /></Reveal>
        <Reveal direction="left"><Features /></Reveal>
        <Reveal><Tools /></Reveal>
        <Reveal direction="right"><CLI /></Reveal>
        <Reveal><Auth /></Reveal>
        <Reveal direction="left"><Config /></Reveal>
        <Reveal><Lifecycle /></Reveal>
        <Reveal><Install /></Reveal>
        <Reveal><Comparison /></Reveal>
        <Reveal><TechStack /></Reveal>
        <Reveal><Clients /></Reveal>
        <Footer />
      </div>
    </main>
  );
}
