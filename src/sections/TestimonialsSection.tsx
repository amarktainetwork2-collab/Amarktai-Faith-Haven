import { HeartHandshake, LockKeyhole, ShieldCheck } from 'lucide-react';

const commitments = [
  { icon: ShieldCheck, title: 'Thoughtful release controls', description: 'FaithHaven is released through staged validation, explicit provider activation, and reviewable operational checks.' },
  { icon: LockKeyhole, title: 'Private by design', description: 'Private journals, secure sessions, and server-authorized data controls are designed to keep account data within the appropriate boundary.' },
  { icon: HeartHandshake, title: 'Human review matters', description: 'AI-assisted drafts are clearly identified and should be reviewed for accuracy, context, theological fit, and pastoral suitability.' },
];

export default function TestimonialsSection() {
  return <section id="commitments" className="py-20 lg:py-32 px-4 sm:px-6 lg:px-8 bg-[hsl(48,60%,98%)]"><div className="max-w-7xl mx-auto"><div className="text-center mb-16"><p className="text-sm font-semibold tracking-wide uppercase text-[hsl(210,70%,50%)]">Our approach</p><h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-800">Built for a careful, <span className="text-gradient">responsible launch</span></h2><p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">We do not publish invented testimonials, adoption figures, or ratings. Product claims are limited to the capabilities and safeguards that can be verified.</p></div><div className="grid md:grid-cols-3 gap-6">{commitments.map((commitment) => <article key={commitment.title} className="bg-white rounded-2xl p-7 border border-[hsl(48,30%,88%)] shadow-sm"><div className="w-12 h-12 rounded-xl bg-[hsl(210,80%,95%)] text-[hsl(210,70%,50%)] flex items-center justify-center"><commitment.icon className="w-6 h-6" /></div><h3 className="mt-5 text-xl font-bold text-slate-800">{commitment.title}</h3><p className="mt-3 text-slate-600 leading-relaxed">{commitment.description}</p></article>)}</div></div></section>;
}
