'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { usePusher } from '@/components/providers/PusherProvider';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/fetch';
import {
  Power, PowerOff, Bell, CheckCircle, XCircle, Clock, Star,
  Wallet, TrendingUp, History, AlertTriangle, Zap, ChevronRight,
  LogOut, Timer, DollarSign, FileText, User, Volume2, Camera, Tag, Save, X, Edit3
} from 'lucide-react';

interface OrderOffer {
  distributionId: string;
  orderId: string;
  orderNumber: string;
  penjokiId: string;
  serviceType: string;
  description: string;
  price: number;
  commission: number;
  deadline: string | null;
  customerName: string;
  responseTimeout: number;
  timestamp: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  serviceType: string;
  description: string;
  price: number;
  commission: number;
  status: string;
  deadline: string | null;
  createdAt: string;
  assignedAt: string | null;
}

export default function PenjokiDashboard() {
  const { user, logout, refreshUser } = useAuth();
  const { subscribe, isConnected } = usePusher();
  const router = useRouter();

  // Resolve penjokiId from either top-level or nested penjoki object
  const penjokiId = user?.penjokiId || user?.penjoki?.id;

  const [isOnline, setIsOnline] = useState(false);
  const [currentOffer, setCurrentOffer] = useState<OrderOffer | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'history' | 'profile'>('dashboard');
  const [stats, setStats] = useState({
    totalOrder: 0,
    completedOrder: 0,
    rating: 5.0,
    balance: 0,
    level: 1,
  });
  const [notification, setNotification] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [editingSpec, setEditingSpec] = useState(false);
  const [specInput, setSpecInput] = useState('');
  const [specializations, setSpecializations] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize
  useEffect(() => {
    if (user?.penjoki) {
      setIsOnline(user.penjoki.status === 'ONLINE' || user.penjoki.status === 'AVAILABLE');
      setStats({
        totalOrder: user.penjoki.totalOrder,
        completedOrder: user.penjoki.completedOrder,
        rating: user.penjoki.rating,
        balance: user.penjoki.balance,
        level: user.penjoki.level,
      });
      if (user.penjoki.avatar) setAvatarPreview(user.penjoki.avatar);
      if (user.penjoki.specialization) setSpecializations(user.penjoki.specialization);
    }
    fetchOrders();
  }, [user]);

  // Subscribe to real-time events
  useEffect(() => {
    if (!penjokiId) return;

    // Listen for order offers
    subscribe('distribution', 'order-offer', (data: unknown) => {
      const offer = data as OrderOffer;
      if (offer.penjokiId === penjokiId) {
        setCurrentOffer(offer);
        setCountdown(offer.responseTimeout);
        playNotificationSound();
        showNotification(`Order baru: ${offer.serviceType}`);
      }
    });

    // Listen for order accepted by someone else
    subscribe('distribution', 'order-accepted', (data: unknown) => {
      const d = data as { orderId: string };
      if (currentOffer?.orderId === d.orderId) {
        setCurrentOffer(null);
        setCountdown(0);
      }
      fetchOrders();
    });

    // Listen for order completed
    subscribe('distribution', 'order-completed', (data: unknown) => {
      fetchOrders();
      refreshUser();
    });

    // Listen for order timeout
    subscribe('distribution', 'order-timeout', (data: unknown) => {
      const d = data as { penjokiId: string };
      if (d.penjokiId === penjokiId) {
        setCurrentOffer(null);
        setCountdown(0);
      }
    });

    // Listen for status changes
    subscribe('distribution', 'penjoki-status-changed', (data: unknown) => {
      const d = data as { penjokiId: string; status: string };
      if (d.penjokiId === penjokiId) {
        setIsOnline(d.status === 'ONLINE' || d.status === 'AVAILABLE');
      }
    });
  }, [user, subscribe, currentOffer]);

  // Countdown timer for order offers
  useEffect(() => {
    if (countdown > 0 && currentOffer) {
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // Auto timeout
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [countdown > 0, currentOffer]);

  const playNotificationSound = () => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgib23teleNjBUg7y6x3xLQj1Qfrmzy4BTQDtLd7WswoRdTEE6Sn+0s8yFZUxBN0WDs6zPjXRURD1AO8GsrNGUglpEPkSrrNKXiWBJQkNBsq3MnIdkR0I/RcG1r8udimFIOUJDxa6vzaCJYUhDPz+/s7PJkZBnSEE9Prqxs8eQj2hNRT08');
      }
      audioRef.current.play().catch(() => {});
    } catch {}
  };

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 5000);
    
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        navigator.serviceWorker?.ready.then((reg) => {
          reg.showNotification('DoneFast', { body: message, icon: '/favicon.ico' });
        });
      } catch {
        // Fallback: silently ignore if service worker not available
      }
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await authFetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch {}
  };

  const toggleOnline = async () => {
    if (!penjokiId) return;
    setLoading(true);
    try {
      const newStatus = isOnline ? 'OFFLINE' : 'AVAILABLE';
      const res = await authFetch(`/api/penjoki/${penjokiId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setIsOnline(!isOnline);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!currentOffer || !penjokiId) return;
    setLoading(true);
    try {
      const res = await authFetch('/api/distribution/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distributionId: currentOffer.distributionId,
          action: 'accept',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentOffer(null);
        setCountdown(0);
        showNotification('Order berhasil diterima! ✅');
        fetchOrders();
        refreshUser();
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleReject = async (reason?: string) => {
    if (!currentOffer || !penjokiId) return;
    setLoading(true);
    try {
      const res = await authFetch('/api/distribution/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distributionId: currentOffer.distributionId,
          action: 'reject',
          reason: reason || 'Ditolak oleh penjoki',
          penjokiId: penjokiId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Reject error:', data);
        showNotification('Gagal menolak order: ' + (data.error || data.message));
      } else {
        showNotification('Order ditolak');
      }
      setCurrentOffer(null);
      setCountdown(0);
      fetchOrders();
    } catch (err) {
      console.error('Reject exception:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeout = async () => {
    if (!currentOffer || !penjokiId) return;
    try {
      await authFetch('/api/distribution/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distributionId: currentOffer.distributionId,
          action: 'timeout',
          orderId: currentOffer.orderId,
          penjokiId: penjokiId,
        }),
      });
    } catch {}
    setCurrentOffer(null);
    setCountdown(0);
  };

  const handleStartProcessing = async (orderId: string) => {
    try {
      const res = await authFetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-processing' }),
      });
      if (res.ok) {
        fetchOrders();
        showNotification('Order mulai diproses');
      }
    } catch {}
  };

  const handleCompleteOrder = async (orderId: string) => {
    try {
      const res = await authFetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });
      if (res.ok) {
        fetchOrders();
        refreshUser();
        showNotification('Order selesai! 🎉');
      }
    } catch {}
  };

  const handleLogout = async () => {
    if (isOnline && penjokiId) {
      await authFetch(`/api/penjoki/${penjokiId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'OFFLINE' }),
      });
    }
    await logout();
    router.push('/');
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !penjokiId) return;

    if (file.size > 2 * 1024 * 1024) {
      showNotification('Ukuran foto maksimal 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setAvatarPreview(base64);
      try {
        const res = await authFetch(`/api/penjoki/${penjokiId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: base64 }),
        });
        if (res.ok) {
          showNotification('Foto profil berhasil diperbarui');
          refreshUser();
        }
      } catch {}
    };
    reader.readAsDataURL(file);
  };

  const handleAddSpecialization = async () => {
    if (!specInput.trim() || !penjokiId) return;
    const newSpecs = [...specializations, specInput.trim()];
    setSpecializations(newSpecs);
    setSpecInput('');
    try {
      const res = await authFetch(`/api/penjoki/${penjokiId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialization: newSpecs }),
      });
      if (res.ok) {
        showNotification('Spesialisasi ditambahkan');
        refreshUser();
      }
    } catch {}
  };

  const handleRemoveSpecialization = async (index: number) => {
    if (!penjokiId) return;
    const newSpecs = specializations.filter((_, i) => i !== index);
    setSpecializations(newSpecs);
    try {
      await authFetch(`/api/penjoki/${penjokiId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialization: newSpecs }),
      });
      showNotification('Spesialisasi dihapus');
      refreshUser();
    } catch {}
  };

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const activeOrders = orders.filter(o => ['ACCEPTED', 'PROCESSING'].includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'COMPLETED');

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Notification Banner */}
      {notification && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white text-center py-3 px-4 animate-slide-down">
          <p className="text-sm font-medium">{notification}</p>
        </div>
      )}

      {/* Order Offer Modal */}
      {currentOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-800 rounded-3xl w-full max-w-md overflow-hidden border border-gray-700 animate-bounce-in shadow-2xl shadow-blue-500/20">
            {/* Header with countdown */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center relative">
              <div className="absolute top-4 right-4 flex items-center gap-1">
                <Volume2 className="w-4 h-4 text-white/70" />
              </div>
              <Bell className="w-12 h-12 text-white mx-auto mb-2 animate-ring" />
              <h2 className="text-xl font-bold">Order Baru Masuk!</h2>
              <p className="text-blue-100 text-sm mt-1">{currentOffer.orderNumber}</p>
              
              {/* Countdown Circle */}
              <div className="mt-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur">
                <span className={`text-2xl font-bold ${countdown <= 10 ? 'text-red-300 animate-pulse' : 'text-white'}`}>
                  {countdown}
                </span>
              </div>
              <p className="text-blue-200 text-xs mt-1">detik tersisa</p>

              {/* Progress bar */}
              <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-1000 rounded-full"
                  style={{ width: `${(countdown / currentOffer.responseTimeout) * 100}%` }}
                />
              </div>
            </div>

            {/* Order Details */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-700/50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs">Jenis Joki</p>
                  <p className="text-white font-semibold text-sm mt-1">{currentOffer.serviceType}</p>
                </div>
                <div className="bg-gray-700/50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs">Customer</p>
                  <p className="text-white font-semibold text-sm mt-1">{currentOffer.customerName}</p>
                </div>
              </div>

              <div className="bg-gray-700/50 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-1">Deskripsi</p>
                <p className="text-white text-sm line-clamp-3">{currentOffer.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-900/30 border border-green-700/30 rounded-xl p-3">
                  <p className="text-green-400 text-xs">Bayaran Anda</p>
                  <p className="text-green-300 font-bold text-lg">{formatPrice(currentOffer.commission)}</p>
                </div>
                <div className="bg-gray-700/50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs">Deadline</p>
                  <p className="text-white font-semibold text-sm mt-1">
                    {currentOffer.deadline ? formatDate(currentOffer.deadline) : 'Fleksibel'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => handleReject()}
                  disabled={loading}
                  className="py-4 px-4 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/30 font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <XCircle className="w-5 h-5" />
                  Tolak
                </button>
                <button
                  onClick={handleAccept}
                  disabled={loading}
                  className="py-4 px-4 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-green-600/30"
                >
                  <CheckCircle className="w-5 h-5" />
                  Terima
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-sm">DoneFast</h1>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                <span className="text-xs text-gray-400">{isOnline ? 'Online' : 'Offline'}</span>
                {isConnected && <span className="text-xs text-green-500 ml-1">• Live</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Online Toggle */}
            <button
              onClick={toggleOnline}
              disabled={loading}
              className={`p-2.5 rounded-xl transition-all ${
                isOnline
                  ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                  : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
              }`}
            >
              {isOnline ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
            </button>

            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:text-red-400 transition"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto pb-24">
        {/* Status Banner */}
        {!isOnline && (
          <div className="mx-4 mt-4 bg-yellow-900/20 border border-yellow-700/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            <div>
              <p className="text-yellow-400 text-sm font-medium">Anda sedang Offline</p>
              <p className="text-yellow-600 text-xs mt-0.5">Aktifkan untuk menerima order baru</p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 p-4">
          <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-400">Saldo</span>
            </div>
            <p className="text-xl font-bold text-white">{formatPrice(stats.balance)}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-gray-400">Rating</span>
            </div>
            <p className="text-xl font-bold text-white">{stats.rating.toFixed(1)}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-400">Total Order</span>
            </div>
            <p className="text-xl font-bold text-white">{stats.totalOrder}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-400">Selesai</span>
            </div>
            <p className="text-xl font-bold text-white">{stats.completedOrder}</p>
          </div>
        </div>

        {/* Level Badge */}
        <div className="mx-4 mb-4 bg-gradient-to-r from-blue-900/50 to-indigo-900/50 border border-blue-700/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600/30 rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold text-blue-300">Lv</span>
            </div>
            <div>
              <p className="text-blue-200 text-sm font-medium">Level {stats.level}</p>
              <p className="text-blue-400 text-xs">Penjoki {user?.name || ''}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-blue-400" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-4 mb-4 bg-gray-800/50 rounded-xl p-1">
          {[
            { id: 'dashboard' as const, label: 'Aktif', icon: Zap },
            { id: 'orders' as const, label: 'Order', icon: FileText },
            { id: 'history' as const, label: 'Riwayat', icon: History },
            { id: 'profile' as const, label: 'Profil', icon: User },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active Orders Tab */}
        {activeTab === 'dashboard' && (
          <div className="px-4 space-y-3">
            {activeOrders.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">Belum ada order aktif</p>
                <p className="text-gray-600 text-sm mt-1">
                  {isOnline ? 'Menunggu order masuk...' : 'Aktifkan status online untuk menerima order'}
                </p>
              </div>
            ) : (
              activeOrders.map((order) => (
                <div key={order.id} className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-xs text-blue-400 font-mono">{order.orderNumber}</span>
                      <h3 className="text-white font-medium mt-0.5">{order.serviceType}</h3>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      order.status === 'PROCESSING'
                        ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/30'
                        : 'bg-blue-900/30 text-blue-400 border border-blue-700/30'
                    }`}>
                      {order.status === 'PROCESSING' ? 'Diproses' : 'Diterima'}
                    </span>
                  </div>

                  <p className="text-gray-400 text-sm line-clamp-2 mb-3">{order.description}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 font-semibold">{formatPrice(order.commission)}</span>
                    </div>
                    {order.deadline && (
                      <div className="flex items-center gap-1 text-gray-500 text-xs">
                        <Timer className="w-3 h-3" />
                        {formatDate(order.deadline)}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-3">
                    {order.status === 'ACCEPTED' && (
                      <button
                        onClick={() => handleStartProcessing(order.id)}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-all"
                      >
                        Mulai Kerjakan
                      </button>
                    )}
                    {order.status === 'PROCESSING' && (
                      <button
                        onClick={() => handleCompleteOrder(order.id)}
                        className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-xl transition-all"
                      >
                        Selesai ✓
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* All Orders Tab */}
        {activeTab === 'orders' && (
          <div className="px-4 space-y-3">
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Belum ada order</p>
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-blue-400 font-mono">{order.orderNumber}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      order.status === 'COMPLETED' ? 'bg-green-900/30 text-green-400' :
                      order.status === 'PROCESSING' ? 'bg-yellow-900/30 text-yellow-400' :
                      order.status === 'ACCEPTED' ? 'bg-blue-900/30 text-blue-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  <h3 className="text-white font-medium text-sm">{order.serviceType}</h3>
                  <p className="text-gray-500 text-xs mt-1">{order.customerName}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-green-400 text-sm font-medium">{formatPrice(order.commission)}</span>
                    <span className="text-gray-600 text-xs">{formatDate(order.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="px-4 space-y-3">
            {completedOrders.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Belum ada riwayat</p>
              </div>
            ) : (
              completedOrders.map((order) => (
                <div key={order.id} className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-500 font-mono">{order.orderNumber}</span>
                      <h3 className="text-white font-medium text-sm mt-0.5">{order.serviceType}</h3>
                    </div>
                    <span className="text-green-400 font-semibold">{formatPrice(order.commission)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-gray-500 text-xs">{order.customerName}</span>
                    <span className="text-gray-600 text-xs">{formatDate(order.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="px-4 space-y-4">
            {/* Avatar Section */}
            <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-6 text-center">
              <div className="relative inline-block">
                <div className="w-24 h-24 rounded-full bg-gray-700 mx-auto overflow-hidden border-2 border-gray-600">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-10 h-10 text-gray-500" />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center border-2 border-gray-800 hover:bg-blue-500 transition"
                >
                  <Camera className="w-4 h-4 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <h2 className="text-white font-semibold text-lg mt-3">{user?.name}</h2>
              <p className="text-gray-500 text-sm">{user?.email}</p>
              {user?.penjoki?.phone && (
                <p className="text-gray-500 text-sm">{user.penjoki.phone}</p>
              )}
            </div>

            {/* Stats Summary */}
            <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Statistik
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-700/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Rating</p>
                  <p className="text-lg font-bold text-yellow-400 flex items-center justify-center gap-1">
                    <Star className="w-4 h-4" />{stats.rating.toFixed(1)}
                  </p>
                </div>
                <div className="bg-gray-700/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Level</p>
                  <p className="text-lg font-bold text-blue-400">{stats.level}</p>
                </div>
                <div className="bg-gray-700/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Total Order</p>
                  <p className="text-lg font-bold text-white">{stats.totalOrder}</p>
                </div>
                <div className="bg-gray-700/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Selesai</p>
                  <p className="text-lg font-bold text-green-400">{stats.completedOrder}</p>
                </div>
              </div>
              <div className="mt-3 bg-gray-700/30 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Rating dihitung otomatis berdasarkan:</p>
                <ul className="text-xs text-gray-400 space-y-0.5">
                  <li>• Jumlah order yang diselesaikan</li>
                  <li>• Ketepatan waktu pengerjaan (sebelum deadline)</li>
                </ul>
              </div>
            </div>

            {/* Specialization Section */}
            <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Tag className="w-4 h-4 text-purple-400" />
                  Spesialisasi
                </h3>
                <button
                  onClick={() => setEditingSpec(!editingSpec)}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                >
                  <Edit3 className="w-3 h-3" />
                  {editingSpec ? 'Selesai' : 'Edit'}
                </button>
              </div>

              {/* Current specializations */}
              <div className="flex flex-wrap gap-2 mb-3">
                {specializations.length === 0 ? (
                  <p className="text-gray-500 text-sm">Belum ada spesialisasi</p>
                ) : (
                  specializations.map((spec, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-900/30 text-purple-300 border border-purple-700/30 rounded-full text-sm">
                      {spec}
                      {editingSpec && (
                        <button
                          onClick={() => handleRemoveSpecialization(i)}
                          className="ml-1 hover:text-red-400 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))
                )}
              </div>

              {/* Add specialization */}
              {editingSpec && (
                <div className="space-y-2">
                  {/* Quick pick */}
                  <div className="flex flex-wrap gap-1.5">
                    {['Pemrograman', 'Akademik', 'Skripsi', 'Makalah', 'Web Development', 'Mobile App', 'Desain', 'PPT', 'Jurnal', 'Data Analysis'].filter(s => !specializations.includes(s)).map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          const newSpecs = [...specializations, s];
                          setSpecializations(newSpecs);
                          authFetch(`/api/penjoki/${penjokiId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ specialization: newSpecs }),
                          }).then(() => { showNotification(`Spesialisasi "${s}" ditambahkan`); refreshUser(); });
                        }}
                        className="px-2.5 py-1 bg-gray-700/50 text-gray-300 rounded-full text-xs hover:bg-purple-900/30 hover:text-purple-300 border border-gray-600/30 hover:border-purple-700/30 transition"
                      >
                        + {s}
                      </button>
                    ))}
                  </div>

                  {/* Custom input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={specInput}
                      onChange={(e) => setSpecInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSpecialization()}
                      placeholder="Spesialisasi custom..."
                      className="flex-1 px-3 py-2 bg-gray-700/50 border border-gray-600/30 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={handleAddSpecialization}
                      disabled={!specInput.trim()}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur-xl border-t border-gray-800 z-40">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2">
          {[
            { id: 'dashboard' as const, label: 'Beranda', icon: Zap },
            { id: 'orders' as const, label: 'Order', icon: FileText },
            { id: 'history' as const, label: 'Riwayat', icon: History },
            { id: 'profile' as const, label: 'Profil', icon: User },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition ${
                activeTab === tab.id ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-xs">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
