'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import PenjokiDashboard from '@/components/PenjokiDashboard';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PenjokiPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/');
      } else if (user.role === 'ADMIN') {
        router.push('/admin');
      }
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <PenjokiDashboard />;
}
