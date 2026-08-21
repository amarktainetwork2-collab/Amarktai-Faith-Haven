import { Link } from 'react-router-dom';
import { Cross, Heart, Mail } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

const footerLinks = {
  product: [
    { label: 'Features', href: '/#features' },
    { label: 'Pricing', href: '/#pricing' },
    { label: 'Our approach', href: '/#commitments' },
    { label: 'FAQ', href: '/help' },
  ],
  company: [
    { label: 'About Us', href: '/about' },
    { label: 'Contact', href: '/contact' },
    { label: 'Careers', href: '/careers' },
    { label: 'Press', href: '/press' },
  ],
  resources: [
    { label: 'Blog', href: '/blog' },
    { label: 'Help Center', href: '/help' },
    { label: 'Community', href: '/community' },
    { label: 'Guidelines', href: '/guidelines' },
  ],
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Cookie Policy', href: '/cookies' },
    { label: 'GDPR', href: '/gdpr' },
  ],
};

const denominations = [
  'Catholic', 'Orthodox', 'Anglican', 'Lutheran', 'Methodist',
  'Presbyterian', 'Baptist', 'Pentecostal', 'Charismatic', 'Reformed',
  'Non-denominational', 'Other'
];

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="bg-slate-900 text-slate-300">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(210,70%,60%)] to-[hsl(260,50%,65%)] flex items-center justify-center">
                <Cross className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">
                FaithHaven
              </span>
            </Link>
            <p className="text-slate-400 mb-6 max-w-sm">
              {t('footer.tagline')}
            </p>
            
            {/* Contact Info */}
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-[hsl(210,70%,60%)]" />
              <Link to="/contact" className="hover:text-[hsl(210,70%,60%)]">Use the contact form for an inquiry</Link>
            </div>
          </div>

          {/* Links Columns */}
          <div>
            <h4 className="text-white font-semibold mb-4">{t('footer.product')}</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm hover:text-[hsl(210,70%,60%)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">{t('footer.company')}</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm hover:text-[hsl(210,70%,60%)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">{t('footer.resources')}</h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm hover:text-[hsl(210,70%,60%)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">{t('footer.legal')}</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm hover:text-[hsl(210,70%,60%)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Denominations */}
        <div className="mt-12 pt-8 border-t border-slate-800">
          <h4 className="text-white font-semibold mb-4">{t('footer.supportedDenominations')}</h4>
          <div className="flex flex-wrap gap-2">
            {denominations.map((denom) => (
              <span
                key={denom}
                className="px-3 py-1 rounded-full bg-slate-800 text-xs text-slate-400"
              >
                {denom}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-slate-500 text-center md:text-left">
              © 2026 FaithHaven AI – built with{' '}
              <Heart className="w-4 h-4 inline text-[hsl(340,60%,65%)] fill-[hsl(340,60%,65%)]" />{' '}
              for careful spiritual practice.
            </div>
            <div className="flex items-center gap-6">
              <span className="text-xs text-slate-600">
                {t('footer.availableIn')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
