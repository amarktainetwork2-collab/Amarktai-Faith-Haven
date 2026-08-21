import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError, apiRequest } from '@/lib/api';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const token = params.get('token') || '';
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) { toast.error('This reset link is invalid.'); return; }
    if (password !== confirmation) { toast.error('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      await apiRequest('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
      toast.success('Password updated. Please sign in.'); navigate('/login', { replace: true });
    } catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to reset your password.'); }
    finally { setSubmitting(false); }
  };
  return <div className="min-h-screen flex items-center justify-center bg-[hsl(48,60%,98%)] p-4"><form onSubmit={(event) => void submit(event)} className="bg-white p-8 rounded-2xl border w-full max-w-md"><h1 className="text-2xl font-bold mb-2">Choose a new password</h1><p className="text-sm text-slate-600 mb-4">Use at least 12 characters with upper-case, lower-case, and numeric characters.</p><label className="block text-sm font-medium mb-2" htmlFor="new-password">New password</label><input id="new-password" className="w-full h-11 px-3 border rounded-lg mb-4" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required /><label className="block text-sm font-medium mb-2" htmlFor="confirm-password">Confirm password</label><input id="confirm-password" className="w-full h-11 px-3 border rounded-lg mb-4" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required /><button disabled={submitting || !token} className="w-full h-11 bg-[hsl(210,70%,60%)] text-white rounded-lg disabled:opacity-60">{submitting ? 'Updating…' : 'Update password'}</button><Link className="block mt-4 text-sm text-[hsl(210,70%,50%)]" to="/login">Back to login</Link></form></div>;
}
