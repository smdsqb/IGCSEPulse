// src/app/page.tsx
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import AiSection from "@/components/AiSection";
import Community from "@/components/Community";  // ← keep this as Community
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <AiSection />
        <Community />
      </main>
      <Footer />
    </>
  );
}
