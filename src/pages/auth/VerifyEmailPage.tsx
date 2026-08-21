import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { ApiError, apiRequest } from '@/lib/api';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState<'loading' | 'success' | 'error'>(() => token ? 'loading' : 'error');
  const [message, setMessage] = useState(() => token ? 'Verifying your email address…' : 'This verification link is invalid.');
  useEffect(() => {
    if (!token) return;
    void apiRequest('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => { setState('success'); setMessage('Your email address has been verified.'); })
      .catch((error) => { setState('error'); setMessage(error instanceof ApiError ? error.message : 'Unable to verify this email address.'); });
  }, [token]);
  const icon = state === 'success' ? <CheckCircle2 className="w-12 h-12 text-emerald-600" /> : state === 'error' ? <XCircle className="w-12 h-12 text-red-600" /> : <div className="w-12 h-12 rounded-full border-4 border-[hsl(210,70%,60%)] border-t-transparent animate-spin" />;
  return <div className="min-h-screen flex items-center justify-center bg-[hsl(48,60%,98%)] p-4"><main className="bg-white p-8 rounded-2xl border w-full max-w-md text-center">{icon}<h1 className="mt-4 text-2xl font-bold">{state === 'success' ? 'Email verified' : state === 'error' ? 'Verification unavailable' : 'Verifying email'}</h1><p className="mt-2 text-slate-600">{message}</p><Link className="inline-block mt-6 text-[hsl(210,70%,50%)]" to={state === 'success' ? '/dashboard' : '/login'}>{state === 'success' ? 'Continue to FaithHaven' : 'Return to login'}</Link></main></div>;
}
