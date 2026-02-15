'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import LoginPage from '@/components/LoginPage';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'ADMIN') {
        router.push('/admin');
      } else if (user.role === 'CUSTOMER') {
        router.push('/customer');
      } else {
        router.push('/penjoki');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Memuat...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <LoginPage />;
}
