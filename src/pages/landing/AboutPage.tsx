import { Link } from 'react-router-dom';
import { Cross, Heart, Users, Globe, BookOpen, Sparkles } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const values = [
  {
    icon: Heart,
    title: 'Faith-Centered',
    description: 'Everything we build is rooted in Scripture and designed to deepen your relationship with God.',
  },
  {
    icon: Users,
    title: 'Community-Driven',
    description: 'We believe in the power of believers coming together to support and encourage one another.',
  },
  {
    icon: Globe,
    title: 'Globally Accessible',
    description: 'Our platform serves Christians worldwide, with support for multiple languages and denominations.',
  },
  {
    icon: BookOpen,
    title: 'Biblically Sound',
    description: 'All content is reviewed to ensure alignment with orthodox Christian teaching.',
  },
];

const team = [
  {
    name: 'David Morrison',
    role: 'Founder & CEO',
    bio: 'Passionate about using technology to spread the Gospel and serve the Church.',
  },
  {
    name: 'Sarah Chen',
    role: 'Head of Product',
    bio: 'Dedicated to creating intuitive experiences that help people grow in their faith.',
  },
  {
    name: 'Pastor Michael Okonkwo',
    role: 'Theological Advisor',
    bio: 'Ensuring all content is biblically sound and spiritually enriching.',
  },
  {
    name: 'Emily van der Merwe',
    role: 'Community Lead',
    bio: 'Building bridges between denominations and fostering unity in Christ.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[hsl(48,60%,98%)]">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(210,80%,95%)] text-[hsl(210,70%,50%)] text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Our Story
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-800 mb-6">
            Building Technology for the{' '}
            <span className="text-gradient">Kingdom</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            FaithHaven AI was born from a simple belief: technology should bring people closer to God, 
            not further away. We're on a mission to equip every believer with powerful tools for spiritual growth.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-6">
                Our Mission
              </h2>
              <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                To create accessible, AI-powered tools that help Christians of all denominations 
                deepen their faith, strengthen their prayer life, and grow in their knowledge of Scripture.
              </p>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                We believe that everyone deserves access to thoughtful spiritual resources, regardless
                of their location or background. Subscription availability, pricing, and feature access are
                published only after the live payment catalog has been configured and verified.
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(210,70%,60%)] to-[hsl(260,50%,65%)] flex items-center justify-center">
                  <Cross className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">"Faith comes by hearing"</p>
                  <p className="text-sm text-slate-500">Romans 10:17</p>
                </div>
              </div>
            </div>
              <div className="grid grid-cols-2 gap-6">
              <div className="bg-[hsl(48,90%,92%)] rounded-2xl p-8 text-center"><p className="text-2xl font-bold text-[hsl(210,70%,50%)] mb-2">PostgreSQL</p><p className="text-slate-600">Persistent data model</p></div>
              <div className="bg-[hsl(210,80%,95%)] rounded-2xl p-8 text-center"><p className="text-2xl font-bold text-[hsl(48,80%,45%)] mb-2">GenX</p><p className="text-slate-600">Approved AI gateway</p></div>
              <div className="bg-[hsl(260,50%,95%)] rounded-2xl p-8 text-center"><p className="text-2xl font-bold text-[hsl(260,50%,55%)] mb-2">PWA</p><p className="text-slate-600">Installable web experience</p></div>
              <div className="bg-[hsl(150,30%,95%)] rounded-2xl p-8 text-center"><p className="text-2xl font-bold text-[hsl(150,30%,45%)] mb-2">4</p><p className="text-slate-600">Supported UI languages</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
              Our Values
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              The principles that guide everything we do at FaithHaven AI.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value) => (
              <div key={value.title} className="bg-white rounded-2xl p-8 shadow-sm border border-[hsl(48,30%,88%)] card-hover">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[hsl(210,70%,60%)] to-[hsl(48,90%,65%)] flex items-center justify-center mb-6">
                  <value.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">{value.title}</h3>
                <p className="text-slate-600">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
              Meet Our Team
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              A diverse group of believers united by a common mission.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member) => (
              <div key={member.name} className="bg-[hsl(48,60%,98%)] rounded-2xl p-6 text-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[hsl(210,70%,60%)] to-[hsl(260,50%,65%)] mx-auto mb-4 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">{member.name.charAt(0)}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">{member.name}</h3>
                <p className="text-[hsl(210,70%,50%)] font-medium text-sm mb-3">{member.role}</p>
                <p className="text-slate-600 text-sm">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-[hsl(210,70%,60%)] to-[hsl(260,50%,55%)] rounded-3xl p-12 text-white">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Join Our Mission
            </h2>
            <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
              Be part of a movement that's using technology to spread the Gospel 
              and strengthen believers worldwide.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="px-8 py-4 bg-white text-[hsl(210,70%,50%)] rounded-xl font-semibold hover:bg-[hsl(48,90%,92%)] transition-colors"
              >
                Get Started Free
              </Link>
              <Link
                to="/careers"
                className="px-8 py-4 border-2 border-white text-white rounded-xl font-semibold hover:bg-white/10 transition-colors"
              >
                View Careers
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
