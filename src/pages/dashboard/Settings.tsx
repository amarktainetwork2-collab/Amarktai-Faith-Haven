import { useState } from 'react';
import { User, Mail, Lock, Bell, Globe, Church, Save, Download, Trash2, Send } from 'lucide-react';
import { useAuthStore, useUIStore } from '@/store';
import { ApiError, apiRequest } from '@/lib/api';
import type { Denomination, Language } from '@/types';
import { toast } from 'sonner';

export default function Settings() {
  const { user, updateProfile, changePassword, logout } = useAuthStore();
  const { theme, toggleTheme } = useUIStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    denomination: (user?.denomination || 'nondenominational') as Denomination,
    language: (user?.language || 'en') as Language,
  });

  const [notificationPrefs, setNotificationPrefs] = useState([
    { key: 'devotional', label: 'Daily Devotional Reminders', enabled: true },
    { key: 'prayer', label: 'Prayer Request Updates', enabled: true },
    { key: 'features', label: 'New Features & Updates', enabled: false },
    { key: 'community', label: 'Community Activity', enabled: true },
  ]);
  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [deletionPassword, setDeletionPassword] = useState('');
  const [accountActionBusy, setAccountActionBusy] = useState(false);

  const handleSave = async () => {
    const ok = await updateProfile(formData);
    if (!ok) {
      toast.error('Could not save profile settings.');
      return;
    }

    if (passwords.current && passwords.next) {
      const changed = await changePassword(passwords.current, passwords.next);
      if (!changed) {
        toast.error('Profile saved, but password update failed.');
        return;
      }
      setPasswords({ current: '', next: '' });
    }

    toast.success(`Settings saved (${formData.language.toUpperCase()})`);
  };

  const handleResendVerification = async () => {
    setAccountActionBusy(true);
    try { const result = await apiRequest<{ message: string }>('/api/auth/resend-verification', { method: 'POST' }); toast.success(result.message); }
    catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to request a verification email.'); }
    finally { setAccountActionBusy(false); }
  };

  const handleExport = async () => {
    setAccountActionBusy(true);
    try {
      const data = await apiRequest('/api/user/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `faithhaven-data-export-${Date.now()}.json`; link.click(); URL.revokeObjectURL(url);
      toast.success('Your account export has been downloaded.');
    } catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to export account data.'); }
    finally { setAccountActionBusy(false); }
  };

  const handleDeleteAccount = async () => {
    if (!deletionPassword) { toast.error('Enter your password to confirm account deletion.'); return; }
    if (!window.confirm('Delete this account and revoke all sessions? This action cannot be undone.')) return;
    setAccountActionBusy(true);
    try { await apiRequest('/api/user/account', { method: 'DELETE', body: JSON.stringify({ password: deletionPassword }) }); await logout(); toast.success('Your account has been deleted.'); }
    catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to delete your account.'); }
    finally { setAccountActionBusy(false); }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Lock },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500">Manage your account preferences</p>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-64 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-[hsl(210,70%,60%)] text-white'
                  : 'text-slate-600 hover:bg-[hsl(48,60%,96%)]'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-[hsl(48,30%,88%)] p-8">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-800 mb-6">Profile Settings</h2>
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[hsl(210,70%,60%)] to-[hsl(260,50%,65%)] flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">{user?.name?.charAt(0) || 'U'}</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{user?.name}</p>
                  <p className="text-slate-500">{user?.email}</p>
                </div>
              </div>

              {!user?.emailVerified && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-900">Your email is not verified. Some protected tools remain unavailable until verification is complete.</p>
                  <button disabled={accountActionBusy} onClick={() => void handleResendVerification()} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-medium disabled:opacity-60"><Send className="w-4 h-4" />Resend verification</button>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full h-12 pl-12 pr-4 rounded-xl border border-[hsl(48,30%,88%)] focus:border-[hsl(210,70%,60%)] focus:ring-2 focus:ring-[hsl(210,70%,60%)]/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full h-12 pl-12 pr-4 rounded-xl border border-[hsl(48,30%,88%)] focus:border-[hsl(210,70%,60%)] focus:ring-2 focus:ring-[hsl(210,70%,60%)]/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Denomination</label>
                  <div className="relative">
                    <Church className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <select
                      value={formData.denomination}
                      onChange={(e) => setFormData(prev => ({ ...prev, denomination: e.target.value as Denomination }))}
                      className="w-full h-12 pl-12 pr-4 rounded-xl border border-[hsl(48,30%,88%)] focus:border-[hsl(210,70%,60%)] focus:ring-2 focus:ring-[hsl(210,70%,60%)]/20 outline-none transition-all bg-white"
                    >
                      <option value="catholic">Catholic</option>
                      <option value="orthodox">Orthodox</option>
                      <option value="anglican">Anglican</option>
                      <option value="lutheran">Lutheran</option>
                      <option value="methodist">Methodist</option>
                      <option value="presbyterian">Presbyterian</option>
                      <option value="baptist">Baptist</option>
                      <option value="pentecostal">Pentecostal</option>
                      <option value="nondenominational">Non-denominational</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Language</label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <select
                      value={formData.language}
                      onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value as Language }))}
                      className="w-full h-12 pl-12 pr-4 rounded-xl border border-[hsl(48,30%,88%)] focus:border-[hsl(210,70%,60%)] focus:ring-2 focus:ring-[hsl(210,70%,60%)]/20 outline-none transition-all bg-white"
                    >
                      <option value="en">English</option>
                      <option value="af">Afrikaans</option>
                      <option value="zu">isiZulu</option>
                      <option value="xh">isiXhosa</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Theme Mode</label>
                  <button
                    onClick={toggleTheme}
                    className="w-full h-12 px-4 rounded-xl border border-[hsl(48,30%,88%)] text-left text-slate-700 hover:bg-[hsl(48,60%,96%)]"
                  >
                    {theme === 'dark' ? 'Dark' : 'Light'} (tap to switch)
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-6">Notification Preferences</h2>
              <div className="space-y-4">
                {notificationPrefs.map((item) => (
                  <label key={item.label} className="flex items-center justify-between p-4 bg-[hsl(48,60%,98%)] rounded-xl cursor-pointer">
                    <span className="text-slate-700">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={() => setNotificationPrefs((prev) => prev.map((p) => p.key === item.key ? { ...p, enabled: !p.enabled } : p))}
                      className="w-5 h-5 rounded border-slate-300 text-[hsl(210,70%,60%)] focus:ring-[hsl(210,70%,60%)]"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-6">Security Settings</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Current Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      placeholder="Enter current password"
                      value={passwords.current}
                      onChange={(e) => setPasswords((prev) => ({ ...prev, current: e.target.value }))}
                      className="w-full h-12 pl-12 pr-4 rounded-xl border border-[hsl(48,30%,88%)] focus:border-[hsl(210,70%,60%)] focus:ring-2 focus:ring-[hsl(210,70%,60%)]/20 outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      placeholder="Enter new password"
                      value={passwords.next}
                      onChange={(e) => setPasswords((prev) => ({ ...prev, next: e.target.value }))}
                      className="w-full h-12 pl-12 pr-4 rounded-xl border border-[hsl(48,30%,88%)] focus:border-[hsl(210,70%,60%)] focus:ring-2 focus:ring-[hsl(210,70%,60%)]/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Theme Mode</label>
                  <button
                    onClick={toggleTheme}
                    className="w-full h-12 px-4 rounded-xl border border-[hsl(48,30%,88%)] text-left text-slate-700 hover:bg-[hsl(48,60%,96%)]"
                  >
                    {theme === 'dark' ? 'Dark' : 'Light'} (tap to switch)
                  </button>
                </div>
              </div>
              <section className="mt-8 rounded-xl border border-slate-200 p-4" aria-labelledby="privacy-controls-title">
                <h3 id="privacy-controls-title" className="font-semibold text-slate-800">Your data</h3>
                <p className="mt-1 text-sm text-slate-600">Download a copy of your account data or permanently delete your account and revoke all active sessions.</p>
                <button disabled={accountActionBusy} onClick={() => void handleExport()} className="mt-4 inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-slate-700 disabled:opacity-60"><Download className="w-4 h-4" />Download account data</button>
                <label className="block mt-5 text-sm font-medium text-red-800" htmlFor="delete-account-password">Confirm password to delete account</label>
                <input id="delete-account-password" type="password" value={deletionPassword} onChange={(event) => setDeletionPassword(event.target.value)} autoComplete="current-password" className="mt-2 w-full h-11 px-3 border border-red-200 rounded-lg" />
                <button disabled={accountActionBusy} onClick={() => void handleDeleteAccount()} className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg disabled:opacity-60"><Trash2 className="w-4 h-4" />Delete account</button>
              </section>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-[hsl(48,30%,88%)]">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-3 bg-[hsl(210,70%,60%)] text-white rounded-xl font-medium hover:bg-[hsl(210,60%,50%)] transition-colors"
            >
              <Save className="w-5 h-5" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
