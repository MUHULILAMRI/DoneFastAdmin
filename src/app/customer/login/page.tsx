'use client';

import { Suspense } from 'react';
import CustomerLoginPage from '@/components/CustomerLoginPage';

function PageFallback() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function CustomerLoginRoute() {
  return (
    <Suspense fallback={<PageFallback />}>
      <CustomerLoginPage />
    </Suspense>
  );
}
