import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError, apiRequest } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await apiRequest<{ message: string }>('/api/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email }) });
      toast.success(response.message);
    } catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to submit this request.'); }
    finally { setSubmitting(false); }
  };
  return <div className="min-h-screen flex items-center justify-center bg-[hsl(48,60%,98%)] p-4"><form onSubmit={(event) => void onSubmit(event)} className="bg-white p-8 rounded-2xl border w-full max-w-md"><h1 className="text-2xl font-bold mb-2">Reset password</h1><p className="text-sm text-slate-600 mb-4">Enter your email address. If an eligible account exists, we will send a secure reset link.</p><label className="sr-only" htmlFor="reset-email">Email address</label><input id="reset-email" className="w-full h-11 px-3 border rounded-lg mb-4" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /><button disabled={submitting} className="w-full h-11 bg-[hsl(210,70%,60%)] text-white rounded-lg disabled:opacity-60">{submitting ? 'Sending…' : 'Send reset link'}</button><Link className="block mt-4 text-sm text-[hsl(210,70%,50%)]" to="/login">Back to login</Link></form></div>;
}
