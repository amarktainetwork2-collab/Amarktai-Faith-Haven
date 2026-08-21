import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { useAuthStore, useUIStore } from '@/store';
import ErrorBoundary from '@/components/ErrorBoundary';

const LandingPage = lazy(() => import('@/pages/landing/LandingPage'));
const AboutPage = lazy(() => import('@/pages/landing/AboutPage'));
const ContactPage = lazy(() => import('@/pages/landing/ContactPage'));
const CareersPage = lazy(() => import('@/pages/landing/CareersPage'));
const PressPage = lazy(() => import('@/pages/landing/PressPage'));
const BlogPage = lazy(() => import('@/pages/landing/BlogPage'));
const BlogPostPage = lazy(() => import('@/pages/landing/BlogPostPage'));
const HelpCenterPage = lazy(() => import('@/pages/landing/HelpCenterPage'));
const CommunityPage = lazy(() => import('@/pages/landing/CommunityPage'));
const GuidelinesPage = lazy(() => import('@/pages/landing/GuidelinesPage'));
const PrivacyPolicyPage = lazy(() => import('@/pages/landing/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('@/pages/landing/TermsOfServicePage'));
const CookiePolicyPage = lazy(() => import('@/pages/landing/CookiePolicyPage'));
const GDPRPage = lazy(() => import('@/pages/landing/GDPRPage'));

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'));

const DashboardLayout = lazy(() => import('@/pages/dashboard/DashboardLayout'));
const AIChat = lazy(() => import('@/pages/dashboard/AIChat'));
const PrayerJournal = lazy(() => import('@/pages/dashboard/PrayerJournal'));
const DailyDevotional = lazy(() => import('@/pages/dashboard/DailyDevotional'));
const Calendar = lazy(() => import('@/pages/dashboard/Calendar'));
const SermonCreator = lazy(() => import('@/pages/dashboard/SermonCreator'));
const LiturgyBuilder = lazy(() => import('@/pages/dashboard/LiturgyBuilder'));
const YouthHub = lazy(() => import('@/pages/dashboard/YouthHub'));
const LittleLambs = lazy(() => import('@/pages/dashboard/LittleLambs'));
const BibleAudio = lazy(() => import('@/pages/dashboard/BibleAudio'));
const FamilyDevotionals = lazy(() => import('@/pages/dashboard/FamilyDevotionals'));
const WorshipMusic = lazy(() => import('@/pages/dashboard/WorshipMusic'));
const PrayerWall = lazy(() => import('@/pages/dashboard/PrayerWall'));
const AdminPanel = lazy(() => import('@/pages/dashboard/AdminPanel'));
const Settings = lazy(() => import('@/pages/dashboard/Settings'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, initialized } = useAuthStore();
  if (!initialized) return <div className="min-h-screen grid place-items-center" role="status">Loading your secure session…</div>;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  const { user, initialize } = useAuthStore();
  const { theme } = useUIStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    document.documentElement.lang = user?.language || 'en';
  }, [user?.language]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <ErrorBoundary>
      <Router>
        <Toaster position="top-right" richColors />
        <Suspense fallback={<div className="min-h-screen grid place-items-center">Loading...</div>}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/careers" element={<CareersPage />} />
            <Route path="/press" element={<PressPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:id" element={<BlogPostPage />} />
            <Route path="/help" element={<HelpCenterPage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/guidelines" element={<GuidelinesPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/cookies" element={<CookiePolicyPage />} />
            <Route path="/gdpr" element={<GDPRPage />} />

            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />

            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<AIChat />} />
              <Route path="chat" element={<AIChat />} />
              <Route path="prayer-journal" element={<PrayerJournal />} />
              <Route path="devotional" element={<DailyDevotional />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="sermon-creator" element={<SermonCreator />} />
              <Route path="liturgy" element={<LiturgyBuilder />} />
              <Route path="youth-hub" element={<YouthHub />} />
              <Route path="little-lambs" element={<LittleLambs />} />
              <Route path="bible-audio" element={<BibleAudio />} />
              <Route path="family-devotionals" element={<FamilyDevotionals />} />
              <Route path="worship-music" element={<WorshipMusic />} />
              <Route path="prayer-wall" element={<PrayerWall />} />
              <Route path="admin" element={<AdminPanel />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
