import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import ThreeBackground from "@/components/ThreeBackground";

export default function Home() {
  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-charcoal">
      <ThreeBackground />
      <Header />
      <Hero />
      <Footer />
    </main>
  );
}
