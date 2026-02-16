'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useAuth } from './providers/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LogIn,
  UserPlus,
  Zap,
  ArrowLeft,
  CheckCircle2,
  Shield,
  Clock,
  Star,
} from 'lucide-react';

const MAIN_SITE = process.env.NEXT_PUBLIC_MAIN_SITE_URL || 'https://donefast.vercel.app';

export default function CustomerLoginPage() {
  const { login, register, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const redirect = searchParams.get('redirect') || '/customer';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
  });

  // If already logged in as CUSTOMER, redirect
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === 'CUSTOMER') {
        router.push(redirect);
      } else {
        // Logged in as non-customer, redirect to their page
        router.push('/');
      }
    }
  }, [user, authLoading, router, redirect]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;

      if (isLogin) {
        result = await login(formData.email, formData.password);
      } else {
        result = await register({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: 'CUSTOMER',
        });
      }

      if (result.success) {
        window.location.href = redirect;
      } else {
        setError(result.error || 'Terjadi kesalahan');
      }
    } catch {
      setError('Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 flex flex-col">
      {/* Top bar */}
      <div className="p-4">
        <a
          href={MAIN_SITE}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke DoneFast
        </a>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/25">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">DoneFast</h1>
            <p className="text-blue-300/80 mt-2">
              {isLogin ? 'Masuk untuk kelola ordermu' : 'Daftar dan mulai pesan jasa'}
            </p>
          </div>

          {/* Features badges */}
          {!isLogin && (
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {[
                { icon: <Shield className="w-3.5 h-3.5" />, text: 'Aman & Terpercaya' },
                { icon: <Clock className="w-3.5 h-3.5" />, text: 'Cepat Dikerjakan' },
                { icon: <Star className="w-3.5 h-3.5" />, text: 'Penjoki Terbaik' },
              ].map((badge) => (
                <span
                  key={badge.text}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-300 text-xs rounded-full border border-blue-500/20"
                >
                  {badge.icon}
                  {badge.text}
                </span>
              ))}
            </div>
          )}

          {/* Form */}
          <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800/50 p-8">
            <h2 className="text-xl font-semibold text-white mb-6">
              {isLogin ? 'Masuk ke Akun' : 'Buat Akun Customer'}
            </h2>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Nama Lengkap
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800/70 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      placeholder="Masukkan nama lengkap"
                      required={!isLogin}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      No. WhatsApp (opsional)
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800/70 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      placeholder="08xxxxxxxxx"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800/70 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="email@contoh.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800/70 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isLogin ? (
                  <>
                    <LogIn className="w-5 h-5" />
                    Masuk
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Daftar Sekarang
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-blue-400 hover:text-blue-300 text-sm transition"
              >
                {isLogin
                  ? 'Belum punya akun? Daftar gratis'
                  : 'Sudah punya akun? Masuk di sini'}
              </button>
            </div>
          </div>

          {/* Trust signals */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { value: '500+', label: 'Order Selesai' },
              { value: '4.8★', label: 'Rating' },
              { value: '50+', label: 'Penjoki Aktif' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="text-center bg-gray-900/30 rounded-xl p-3 border border-gray-800/30"
              >
                <p className="text-white font-bold text-lg">{stat.value}</p>
                <p className="text-gray-500 text-[10px]">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Benefits (register mode) */}
          {!isLogin && (
            <div className="mt-6 space-y-3">
              {[
                'Distribusi otomatis ke penjoki terbaik',
                'Tracking order real-time',
                'Harga transparan, tanpa biaya tersembunyi',
                'Garansi revisi jika tidak sesuai',
              ].map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 text-sm text-gray-400">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 text-center">
        <p className="text-gray-600 text-xs">
          © 2026 DoneFast. Platform Jasa Joki Terpercaya.
        </p>
      </div>
    </div>
  );
}
