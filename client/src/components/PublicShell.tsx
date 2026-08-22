import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { House, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

const publicLinks = [
  { href: "/platform", label: "Platform" },
  { href: "/buyers", label: "For buyers" },
  { href: "/agencies", label: "For agencies" },
  { href: "/management", label: "For managers" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
];

export function PublicHeader({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const textClass = overlay ? "text-white" : "text-[#193552]";
  const mutedClass = overlay ? "text-white/75 hover:text-white" : "text-slate-600 hover:text-[#193552]";
  return <header className={overlay ? "absolute inset-x-0 top-0 z-30" : "sticky top-0 z-30 border-b border-[#e7e1d8] bg-[#faf9f6]/95 backdrop-blur"}><a href="#public-main" className="sr-only fixed left-4 top-4 z-50 rounded-md bg-[#193552] px-4 py-2 text-sm font-semibold text-white shadow-lg focus:not-sr-only focus:outline-none focus-visible:ring-4 focus-visible:ring-[#d9a856]">Skip to content</a><div className={`container flex h-20 items-center justify-between ${textClass}`}><Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}><span className={`grid size-9 place-items-center rounded-xl border ${overlay ? "border-white/30 bg-white/10" : "border-[#d8d3c8] bg-white"}`}><House className="size-4" /></span><span className="text-sm font-semibold tracking-tight">Amarktai <span className="text-[#b68238]">Property</span></span></Link><nav aria-label="Public navigation" className="hidden items-center gap-5 xl:flex">{publicLinks.map(link => <Link key={link.href} href={link.href} className={`text-sm transition-colors ${location === link.href ? "font-bold text-[#b68238]" : mutedClass}`}>{link.label}</Link>)}</nav><div className="flex items-center gap-2"><Link href="/report/preview" className={`hidden text-sm sm:block ${mutedClass}`}>Buyer report</Link><Button onClick={() => startLogin()} className="hidden rounded-full bg-[#d9a856] px-5 text-[#193552] hover:bg-[#efc47d] sm:inline-flex">Sign in</Button><button onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label={open ? "Close navigation" : "Open navigation"} className={`grid size-10 place-items-center rounded-lg border xl:hidden ${overlay ? "border-white/25 bg-white/10" : "border-[#ded8cc] bg-white"}`}><span className="sr-only">Menu</span>{open ? <X className="size-5" /> : <Menu className="size-5" />}</button></div></div>{open && <div className="border-t border-[#e7e1d8] bg-[#faf9f6] px-4 py-4 shadow-xl xl:hidden"><nav aria-label="Mobile public navigation" className="container grid gap-1">{publicLinks.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className={`rounded-lg px-3 py-3 text-sm ${location === link.href ? "bg-[#edf2f1] font-bold text-[#193552]" : "text-slate-600 hover:bg-[#f1eee7]"}`}>{link.label}</Link>)}<Link href="/report/preview" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm text-slate-600 hover:bg-[#f1eee7]">Buyer report preview</Link><Button onClick={() => { setOpen(false); startLogin(); }} className="mt-2 rounded-full bg-[#193552] text-white hover:bg-[#264b6c]">Enter the workspace</Button></nav></div>}</header>;
}

export function PublicFooter() {
  return <footer className="bg-[#102940] py-12 text-white/65"><div className="container grid gap-8 md:grid-cols-[1fr_2fr]"><div><p className="text-lg font-semibold text-white">Amarktai <span className="text-[#e5bf78]">Property</span></p><p className="mt-3 max-w-sm text-sm leading-6">A considered property platform for selling with clarity and operating buildings with confidence.</p></div><nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm sm:grid-cols-4">{publicLinks.map(link => <Link key={link.href} href={link.href} className="hover:text-white">{link.label}</Link>)}<Link href="/privacy" className="hover:text-white">Privacy</Link><Link href="/terms" className="hover:text-white">Terms</Link><Link href="/trust" className="hover:text-white">Trust &amp; safety</Link></nav></div><div className="container mt-8 border-t border-white/10 pt-5 text-xs text-white/45">© {new Date().getFullYear()} Amarktai Property. Controlled sharing, source awareness, and tenant boundaries by design.</div></footer>;
}
