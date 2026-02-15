'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { usePusher } from '@/components/providers/PusherProvider';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/fetch';
import {
  BarChart3, Users, ShoppingCart, TrendingUp, Eye, Send, RefreshCw,
  CheckCircle, XCircle, Clock, AlertTriangle, Zap, LogOut, Plus,
  DollarSign, Activity, ArrowRight, Star, Ban, UserCheck, Search,
  Filter, MoreVertical, ChevronDown, Bell, Settings, Award
} from 'lucide-react';

interface Stats {
  orders: { total: number; waiting: number; searching: number; processing: number; completed: number; cancelled: number; };
  penjoki: { total: number; online: number; busy: number; offline: number; };
  distribution: { total: number; accepted: number; rejected: number; timeout: number; acceptanceRate: number; };
  revenue: { totalRevenue: number; totalCommission: number; profit: number; };
  topPenjoki: Array<{ id: string; name: string; rating: number; totalOrder: number; completedOrder: number; rejectedOrder: number; level: number; status: string; totalEarnings: number; }>;
  recentActivity: Array<{ id: string; action: string; entity: string; details: string; createdAt: string; }>;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceType: string;
  description: string;
  price: number;
  commission: number;
  status: string;
  deadline: string | null;
  createdAt: string;
  distributionAttempts: number;
  penjoki?: { id: string; name: string; email: string; rating: number; };
  distributions: Array<{
    id: string;
    status: string;
    sentAt: string;
    respondedAt: string | null;
    reason: string | null;
    responseTime: number | null;
    penjoki: { id: string; name: string; };
  }>;
}

interface Penjoki {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  rating: number;
  totalOrder: number;
  completedOrder: number;
  rejectedOrder: number;
  level: number;
  isActive: boolean;
  isSuspended: boolean;
  lastOnline: string | null;
  balance: number;
  totalEarnings: number;
  commissionRate: number;
  createdAt: string;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { subscribe, isConnected } = usePusher();
  const router = useRouter();

  const [activeView, setActiveView] = useState<'overview' | 'orders' | 'penjoki' | 'monitoring' | 'create-order'>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [penjokis, setPenjokis] = useState<Penjoki[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showCreateOrder, setShowCreateOrder] = useState(false);

  // New order form
  const [newOrder, setNewOrder] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    serviceType: 'Skripsi',
    description: '',
    requirements: '',
    deadline: '',
    price: '',
    distributionStrategy: 'RATING',
    autoDistribute: true,
  });

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, ordersRes, penjokiRes] = await Promise.all([
        authFetch('/api/stats'),
        authFetch('/api/orders?limit=50'),
        authFetch('/api/penjoki'),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.orders || []);
      }
      if (penjokiRes.ok) {
        const data = await penjokiRes.json();
        setPenjokis(data.penjokis || []);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Real-time subscriptions
  useEffect(() => {
    subscribe('private-admin', 'order-accepted', (data: unknown) => {
      const d = data as { message: string };
      showNotif(d.message || 'Order diterima!');
      fetchAll();
    });

    subscribe('private-admin', 'distribution-update', (data: unknown) => {
      const d = data as { message: string };
      showNotif(d.message);
      fetchAll();
    });

    subscribe('private-admin', 'order-completed', (data: unknown) => {
      const d = data as { message: string };
      showNotif(d.message || 'Order selesai!');
      fetchAll();
    });

    subscribe('private-admin', 'penjoki-status-changed', (data: unknown) => {
      fetchAll();
    });

    subscribe('private-admin', 'order-status-changed', (data: unknown) => {
      fetchAll();
    });
  }, [subscribe, fetchAll]);

  const showNotif = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 5000);
  };

  const handleCreateOrder = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder),
      });
      const data = await res.json();
      if (data.success) {
        showNotif(`Order ${data.order.orderNumber} berhasil dibuat!`);
        setShowCreateOrder(false);
        setNewOrder({
          customerName: '', customerEmail: '', customerPhone: '',
          serviceType: 'Skripsi', description: '', requirements: '',
          deadline: '', price: '', distributionStrategy: 'RATING', autoDistribute: true,
        });
        fetchAll();
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleRedistribute = async (orderId: string) => {
    try {
      const res = await authFetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'redistribute' }),
      });
      const data = await res.json();
      showNotif(data.message || 'Redistribusi dimulai');
      fetchAll();
    } catch {}
  };

  const handleManualAssign = async (orderId: string, penjokiId: string) => {
    try {
      const res = await authFetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign-manual', penjokiId }),
      });
      if (res.ok) {
        showNotif('Order berhasil di-assign manual');
        fetchAll();
      }
    } catch {}
  };

  const handleSuspendPenjoki = async (penjokiId: string, action: 'suspend' | 'unsuspend') => {
    try {
      await authFetch(`/api/penjoki/${penjokiId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      showNotif(`Penjoki ${action === 'suspend' ? 'disuspend' : 'diaktifkan kembali'}`);
      fetchAll();
    } catch {}
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const filteredOrders = orderFilter
    ? orders.filter(o => o.status === orderFilter)
    : orders;

  const statusColor = (status: string) => {
    switch (status) {
      case 'WAITING': return 'bg-gray-700 text-gray-300';
      case 'SEARCHING': return 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/30';
      case 'ACCEPTED': return 'bg-blue-900/30 text-blue-400 border border-blue-700/30';
      case 'PROCESSING': return 'bg-indigo-900/30 text-indigo-400 border border-indigo-700/30';
      case 'COMPLETED': return 'bg-green-900/30 text-green-400 border border-green-700/30';
      case 'CANCELLED': return 'bg-red-900/30 text-red-400 border border-red-700/30';
      default: return 'bg-gray-700 text-gray-400';
    }
  };

  const penjokiStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE': case 'AVAILABLE': return 'bg-green-500';
      case 'BUSY': return 'bg-yellow-500';
      case 'OFFLINE': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white rounded-xl px-4 py-3 shadow-xl shadow-blue-600/20 flex items-center gap-2 animate-slide-in max-w-sm">
          <Bell className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm">{notification}</p>
        </div>
      )}

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-gray-900 border-r border-gray-800 z-30 flex flex-col">
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white">DoneFast</h1>
              <p className="text-xs text-gray-500">Admin Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-xs text-gray-500">{isConnected ? 'Real-time aktif' : 'Connecting...'}</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {[
            { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
            { id: 'orders' as const, label: 'Orders', icon: ShoppingCart, badge: stats?.orders.waiting },
            { id: 'penjoki' as const, label: 'Penjoki', icon: Users, badge: stats?.penjoki.online },
            { id: 'monitoring' as const, label: 'Monitoring', icon: Activity },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeView === item.id
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-600/20'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
              <span className="text-sm font-medium">{user?.name?.[0] || 'A'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'Admin'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-900/10 text-sm transition"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {activeView === 'overview' ? 'Dashboard Overview' :
               activeView === 'orders' ? 'Order Management' :
               activeView === 'penjoki' ? 'Penjoki Management' :
               'Live Monitoring'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchAll}
              className="p-2.5 rounded-xl bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700/30 transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setActiveView('orders'); setShowCreateOrder(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              Order Baru
            </button>
          </div>
        </header>

        <div className="p-6">
          {/* ============ OVERVIEW ============ */}
          {activeView === 'overview' && stats && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400 text-sm">Total Orders</span>
                    <ShoppingCart className="w-5 h-5 text-blue-400" />
                  </div>
                  <p className="text-3xl font-bold">{stats.orders.total}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-yellow-400 text-xs">{stats.orders.waiting} menunggu</span>
                    <span className="text-blue-400 text-xs">{stats.orders.searching} dicari</span>
                  </div>
                </div>

                <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400 text-sm">Penjoki Online</span>
                    <Users className="w-5 h-5 text-green-400" />
                  </div>
                  <p className="text-3xl font-bold text-green-400">{stats.penjoki.online}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-yellow-400 text-xs">{stats.penjoki.busy} sibuk</span>
                    <span className="text-gray-500 text-xs">{stats.penjoki.total} total</span>
                  </div>
                </div>

                <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400 text-sm">Acceptance Rate</span>
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                  </div>
                  <p className="text-3xl font-bold">{stats.distribution.acceptanceRate}%</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-green-400 text-xs">{stats.distribution.accepted} diterima</span>
                    <span className="text-red-400 text-xs">{stats.distribution.rejected} ditolak</span>
                  </div>
                </div>

                <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400 text-sm">Revenue</span>
                    <DollarSign className="w-5 h-5 text-green-400" />
                  </div>
                  <p className="text-2xl font-bold text-green-400">{formatPrice(stats.revenue.totalRevenue)}</p>
                  <p className="text-xs text-gray-500 mt-2">Profit: {formatPrice(stats.revenue.profit)}</p>
                </div>
              </div>

              {/* Leaderboard + Activity */}
              <div className="grid grid-cols-2 gap-6">
                {/* Leaderboard */}
                <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Award className="w-4 h-4 text-yellow-400" />
                      Leaderboard Penjoki
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {stats.topPenjoki.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/30 transition">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                          i === 0 ? 'bg-yellow-600/20 text-yellow-400' :
                          i === 1 ? 'bg-gray-600/20 text-gray-300' :
                          i === 2 ? 'bg-orange-900/20 text-orange-400' :
                          'bg-gray-700/50 text-gray-500'
                        }`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>Lv.{p.level}</span>
                            <span>•</span>
                            <span>{p.completedOrder} selesai</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-yellow-400 text-sm">
                            <Star className="w-3 h-3" />
                            {p.rating.toFixed(1)}
                          </div>
                          <div className={`w-2 h-2 rounded-full ml-auto mt-1 ${penjokiStatusColor(p.status)}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-400" />
                      Aktivitas Terbaru
                    </h3>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {stats.recentActivity.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-8">Belum ada aktivitas</p>
                    ) : (
                      stats.recentActivity.map((a) => (
                        <div key={a.id} className="flex items-start gap-3 p-2">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            a.action.includes('ACCEPTED') ? 'bg-green-400' :
                            a.action.includes('REJECTED') ? 'bg-red-400' :
                            'bg-blue-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-300 line-clamp-2">{a.details}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{formatDate(a.createdAt)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Order Status Distribution */}
              <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-5">
                <h3 className="font-semibold mb-4">Distribusi Order</h3>
                <div className="grid grid-cols-6 gap-3">
                  {[
                    { label: 'Menunggu', value: stats.orders.waiting, color: 'text-gray-400' },
                    { label: 'Dicari', value: stats.orders.searching, color: 'text-yellow-400' },
                    { label: 'Diterima', value: stats.orders.processing, color: 'text-blue-400' },
                    { label: 'Diproses', value: stats.orders.processing, color: 'text-indigo-400' },
                    { label: 'Selesai', value: stats.orders.completed, color: 'text-green-400' },
                    { label: 'Dibatalkan', value: stats.orders.cancelled, color: 'text-red-400' },
                  ].map((item) => (
                    <div key={item.label} className="text-center p-3 bg-gray-700/30 rounded-xl">
                      <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============ ORDERS ============ */}
          {activeView === 'orders' && (
            <div className="space-y-4">
              {/* Create Order Form */}
              {showCreateOrder && (
                <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-400" />
                    Buat Order Baru
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Nama Customer"
                      value={newOrder.customerName}
                      onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
                      className="px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="email"
                      placeholder="Email Customer"
                      value={newOrder.customerEmail}
                      onChange={(e) => setNewOrder({ ...newOrder, customerEmail: e.target.value })}
                      className="px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="tel"
                      placeholder="Phone Customer"
                      value={newOrder.customerPhone}
                      onChange={(e) => setNewOrder({ ...newOrder, customerPhone: e.target.value })}
                      className="px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={newOrder.serviceType}
                      onChange={(e) => setNewOrder({ ...newOrder, serviceType: e.target.value })}
                      className="px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Skripsi">Skripsi</option>
                      <option value="Makalah">Makalah</option>
                      <option value="Jurnal">Jurnal</option>
                      <option value="PPT">Presentasi (PPT)</option>
                      <option value="Programming">Programming</option>
                      <option value="Web Development">Web Development</option>
                      <option value="Mobile App">Mobile App</option>
                      <option value="Desain">Desain Grafis</option>
                      <option value="Data Entry">Data Entry</option>
                      <option value="Tugas">Tugas Kuliah</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                    <textarea
                      placeholder="Deskripsi tugas..."
                      value={newOrder.description}
                      onChange={(e) => setNewOrder({ ...newOrder, description: e.target.value })}
                      className="col-span-2 px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                    />
                    <input
                      type="number"
                      placeholder="Harga (Rp)"
                      value={newOrder.price}
                      onChange={(e) => setNewOrder({ ...newOrder, price: e.target.value })}
                      className="px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="datetime-local"
                      value={newOrder.deadline}
                      onChange={(e) => setNewOrder({ ...newOrder, deadline: e.target.value })}
                      className="px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={newOrder.distributionStrategy}
                      onChange={(e) => setNewOrder({ ...newOrder, distributionStrategy: e.target.value })}
                      className="px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="RATING">Distribusi by Rating</option>
                      <option value="WORKLOAD">Distribusi by Workload</option>
                      <option value="LEVEL">Distribusi by Level</option>
                      <option value="RANDOM">Distribusi Random</option>
                    </select>
                    <label className="flex items-center gap-2 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={newOrder.autoDistribute}
                        onChange={(e) => setNewOrder({ ...newOrder, autoDistribute: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-300">Auto-distribusi</span>
                    </label>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={handleCreateOrder}
                      disabled={loading || !newOrder.customerName || !newOrder.description || !newOrder.price}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Buat & Distribusi
                    </button>
                    <button
                      onClick={() => setShowCreateOrder(false)}
                      className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm transition"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {/* Order Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowCreateOrder(!showCreateOrder)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Order Baru
                </button>
                <div className="flex-1" />
                {['', 'WAITING', 'SEARCHING', 'ACCEPTED', 'PROCESSING', 'COMPLETED'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setOrderFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      orderFilter === filter
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    {filter || 'Semua'}
                  </button>
                ))}
              </div>

              {/* Orders Table */}
              <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700/50">
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Order</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Layanan</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Harga</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Penjoki</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/30">
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-700/20 transition">
                          <td className="px-5 py-3">
                            <p className="text-sm font-mono text-blue-400">{order.orderNumber}</p>
                            <p className="text-xs text-gray-600">{formatDate(order.createdAt)}</p>
                          </td>
                          <td className="px-5 py-3">
                            <p className="text-sm">{order.customerName}</p>
                            <p className="text-xs text-gray-500">{order.customerEmail}</p>
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-sm">{order.serviceType}</span>
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-sm font-medium text-green-400">{formatPrice(order.price)}</span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(order.status)}`}>
                              {order.status}
                            </span>
                            {order.distributionAttempts > 0 && (
                              <span className="text-xs text-gray-600 ml-1">({order.distributionAttempts}x)</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {order.penjoki ? (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-blue-600/20 rounded-full flex items-center justify-center">
                                  <span className="text-xs text-blue-400">{order.penjoki.name[0]}</span>
                                </div>
                                <span className="text-sm">{order.penjoki.name}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-600">-</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1">
                              {(order.status === 'WAITING' || order.status === 'SEARCHING') && (
                                <>
                                  <button
                                    onClick={() => handleRedistribute(order.id)}
                                    className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition"
                                    title="Redistribusi"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setSelectedOrder(order)}
                                    className="p-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 transition"
                                    title="Assign Manual"
                                  >
                                    <UserCheck className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => setSelectedOrder(order)}
                                className="p-1.5 rounded-lg bg-gray-700/50 text-gray-400 hover:text-gray-300 transition"
                                title="Detail"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredOrders.length === 0 && (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Tidak ada order</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============ PENJOKI ============ */}
          {activeView === 'penjoki' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {penjokis.map((p) => (
                  <div key={p.id} className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-5 hover:border-gray-600/50 transition">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center relative">
                          <span className="text-blue-400 font-medium">{p.name[0]}</span>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-800 ${penjokiStatusColor(p.status)}`} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.email}</p>
                        </div>
                      </div>
                      {p.isSuspended && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/30 text-red-400">Suspended</span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="text-center p-2 bg-gray-700/30 rounded-lg">
                        <p className="text-xs text-gray-500">Rating</p>
                        <p className="text-sm font-semibold text-yellow-400 flex items-center justify-center gap-0.5">
                          <Star className="w-3 h-3" />{p.rating.toFixed(1)}
                        </p>
                      </div>
                      <div className="text-center p-2 bg-gray-700/30 rounded-lg">
                        <p className="text-xs text-gray-500">Order</p>
                        <p className="text-sm font-semibold">{p.completedOrder}/{p.totalOrder}</p>
                      </div>
                      <div className="text-center p-2 bg-gray-700/30 rounded-lg">
                        <p className="text-xs text-gray-500">Level</p>
                        <p className="text-sm font-semibold text-blue-400">{p.level}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                      <span>Earnings: {formatPrice(p.totalEarnings)}</span>
                      <span>Saldo: {formatPrice(p.balance)}</span>
                    </div>

                    <div className="flex gap-2">
                      {!p.isSuspended ? (
                        <button
                          onClick={() => handleSuspendPenjoki(p.id, 'suspend')}
                          className="flex-1 py-2 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/30 text-xs font-medium transition flex items-center justify-center gap-1"
                        >
                          <Ban className="w-3 h-3" />
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSuspendPenjoki(p.id, 'unsuspend')}
                          className="flex-1 py-2 rounded-lg bg-green-900/20 text-green-400 hover:bg-green-900/30 text-xs font-medium transition flex items-center justify-center gap-1"
                        >
                          <UserCheck className="w-3 h-3" />
                          Unsuspend
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {penjokis.length === 0 && (
                <div className="text-center py-12 bg-gray-800/50 border border-gray-700/30 rounded-2xl">
                  <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500">Belum ada penjoki terdaftar</p>
                </div>
              )}
            </div>
          )}

          {/* ============ MONITORING ============ */}
          {activeView === 'monitoring' && (
            <div className="space-y-6">
              {/* Live Penjoki Status */}
              <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-400 animate-pulse" />
                  Status Penjoki Real-time
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  {penjokis.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 p-3 bg-gray-700/30 rounded-xl">
                      <div className={`w-3 h-3 rounded-full ${penjokiStatusColor(p.status)} ${
                        p.status === 'ONLINE' || p.status === 'AVAILABLE' ? 'animate-pulse' : ''
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{p.status.toLowerCase()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Distributions */}
              <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-400" />
                  Distribusi Aktif
                </h3>
                <div className="space-y-3">
                  {orders.filter(o => o.status === 'SEARCHING').map((order) => (
                    <div key={order.id} className="p-4 bg-yellow-900/10 border border-yellow-700/20 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-mono text-yellow-400">{order.orderNumber}</span>
                          <span className="text-xs text-gray-500 ml-2">{order.serviceType}</span>
                        </div>
                        <span className="text-xs text-yellow-400">Mencari penjoki... ({order.distributionAttempts}x)</span>
                      </div>
                      {order.distributions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {order.distributions.map((d) => (
                            <span key={d.id} className={`text-xs px-2 py-0.5 rounded-full ${
                              d.status === 'ACCEPTED' ? 'bg-green-900/30 text-green-400' :
                              d.status === 'REJECTED' ? 'bg-red-900/30 text-red-400' :
                              d.status === 'TIMEOUT' ? 'bg-gray-700 text-gray-400' :
                              'bg-blue-900/30 text-blue-400 animate-pulse'
                            }`}>
                              {d.penjoki.name}: {d.status}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {orders.filter(o => o.status === 'SEARCHING').length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-8">Tidak ada distribusi aktif</p>
                  )}
                </div>
              </div>

              {/* Waiting Orders */}
              <div className="bg-gray-800/50 border border-gray-700/30 rounded-2xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  Order Menunggu Assignment
                </h3>
                <div className="space-y-3">
                  {orders.filter(o => o.status === 'WAITING').map((order) => (
                    <div key={order.id} className="p-4 bg-gray-700/20 border border-gray-700/30 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-sm font-mono text-gray-400">{order.orderNumber}</span>
                        <span className="text-xs text-gray-500 ml-2">{order.serviceType} - {order.customerName}</span>
                        <span className="text-xs text-green-400 ml-2">{formatPrice(order.price)}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRedistribute(order.id)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium transition flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          Distribusi
                        </button>
                      </div>
                    </div>
                  ))}
                  {orders.filter(o => o.status === 'WAITING').length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-8">Tidak ada order menunggu</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto border border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">{selectedOrder.orderNumber}</h3>
                  <p className="text-sm text-gray-400">{selectedOrder.serviceType}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor(selectedOrder.status)}`}>
                  {selectedOrder.status}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Customer</p>
                  <p className="text-sm font-medium">{selectedOrder.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Harga</p>
                  <p className="text-sm font-medium text-green-400">{formatPrice(selectedOrder.price)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">Deskripsi</p>
                <p className="text-sm text-gray-300">{selectedOrder.description}</p>
              </div>

              {selectedOrder.penjoki && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Penjoki</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                      <span className="text-blue-400 text-sm">{selectedOrder.penjoki.name[0]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{selectedOrder.penjoki.name}</p>
                      <p className="text-xs text-gray-500">Rating: {selectedOrder.penjoki.rating.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Distribution Log */}
              {selectedOrder.distributions.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Log Distribusi</p>
                  <div className="space-y-2">
                    {selectedOrder.distributions.map((d) => (
                      <div key={d.id} className="flex items-center gap-3 p-2 bg-gray-700/30 rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${
                          d.status === 'ACCEPTED' ? 'bg-green-400' :
                          d.status === 'REJECTED' ? 'bg-red-400' :
                          d.status === 'TIMEOUT' ? 'bg-gray-400' :
                          'bg-blue-400 animate-pulse'
                        }`} />
                        <div className="flex-1">
                          <span className="text-sm">{d.penjoki.name}</span>
                          <span className={`ml-2 text-xs ${
                            d.status === 'ACCEPTED' ? 'text-green-400' :
                            d.status === 'REJECTED' ? 'text-red-400' :
                            d.status === 'TIMEOUT' ? 'text-gray-400' :
                            'text-blue-400'
                          }`}>{d.status}</span>
                          {d.reason && <span className="text-xs text-gray-500 ml-2">({d.reason})</span>}
                        </div>
                        <div className="text-xs text-gray-500">
                          {d.responseTime ? `${d.responseTime}s` : '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual Assignment */}
              {(selectedOrder.status === 'WAITING' || selectedOrder.status === 'SEARCHING') && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Assign Manual ke Penjoki</p>
                  <div className="flex flex-wrap gap-2">
                    {penjokis
                      .filter(p => (p.status === 'ONLINE' || p.status === 'AVAILABLE') && !p.isSuspended)
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            handleManualAssign(selectedOrder.id, p.id);
                            setSelectedOrder(null);
                          }}
                          className="px-3 py-1.5 bg-green-900/20 border border-green-700/30 text-green-400 rounded-lg text-xs font-medium hover:bg-green-900/30 transition flex items-center gap-1"
                        >
                          <UserCheck className="w-3 h-3" />
                          {p.name}
                        </button>
                      ))}
                    {penjokis.filter(p => (p.status === 'ONLINE' || p.status === 'AVAILABLE') && !p.isSuspended).length === 0 && (
                      <p className="text-xs text-gray-500">Tidak ada penjoki online</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              {(selectedOrder.status === 'WAITING' || selectedOrder.status === 'SEARCHING') && (
                <button
                  onClick={() => { handleRedistribute(selectedOrder.id); setSelectedOrder(null); }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium transition flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Redistribusi
                </button>
              )}
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
