'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useAuth } from './providers/AuthProvider';
import { usePusher } from './providers/PusherProvider';
import { authFetch } from '@/lib/fetch';
import {
  Package,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  ArrowLeft,
  Send,
  FileText,
  Loader2,
  User,
  LogOut,
  Star,
  CalendarDays,
  DollarSign,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { CHANNELS, EVENTS } from '@/lib/pusher';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  serviceType: string;
  description: string;
  requirements?: string;
  deadline?: string;
  price: number;
  status: string;
  penjoki?: {
    id: string;
    name: string;
    rating: number;
  };
  createdAt: string;
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

interface Stats {
  total: number;
  waiting: number;
  processing: number;
  completed: number;
  cancelled: number;
}

type View = 'orders' | 'new-order' | 'order-detail';
type FilterStatus = 'ALL' | 'WAITING' | 'SEARCHING' | 'ACCEPTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

const SERVICE_TYPES = [
  'Skripsi / Thesis',
  'Makalah / Paper',
  'Jurnal / Journal',
  'Programming',
  'Web Development',
  'Mobile App',
  'Desain Grafis',
  'PPT / Presentasi',
  'Data Entry',
  'Tugas Kuliah',
  'Lainnya',
];

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    WAITING: 'Menunggu',
    SEARCHING: 'Mencari Penjoki',
    ACCEPTED: 'Diterima',
    PROCESSING: 'Dikerjakan',
    COMPLETED: 'Selesai',
    CANCELLED: 'Dibatalkan',
  };
  return map[status] || status;
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    WAITING: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    SEARCHING: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    ACCEPTED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    PROCESSING: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    COMPLETED: 'bg-green-500/15 text-green-400 border-green-500/30',
    CANCELLED: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return map[status] || 'bg-gray-500/15 text-gray-400 border-gray-500/30';
}

function statusIcon(status: string) {
  switch (status) {
    case 'WAITING': return <Clock className="w-4 h-4" />;
    case 'SEARCHING': return <Search className="w-4 h-4" />;
    case 'ACCEPTED': return <CheckCircle2 className="w-4 h-4" />;
    case 'PROCESSING': return <Loader2 className="w-4 h-4 animate-spin" />;
    case 'COMPLETED': return <CheckCircle2 className="w-4 h-4" />;
    case 'CANCELLED': return <XCircle className="w-4 h-4" />;
    default: return <Package className="w-4 h-4" />;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

// ============================================================
// Progress tracker component
// ============================================================
function OrderProgress({ status }: { status: string }) {
  const steps = [
    { key: 'WAITING', label: 'Menunggu' },
    { key: 'SEARCHING', label: 'Mencari' },
    { key: 'ACCEPTED', label: 'Diterima' },
    { key: 'PROCESSING', label: 'Dikerjakan' },
    { key: 'COMPLETED', label: 'Selesai' },
  ];

  const currentIdx = steps.findIndex(s => s.key === status);
  const isCancelled = status === 'CANCELLED';

  return (
    <div className="flex items-center gap-1 w-full">
      {steps.map((step, idx) => {
        const isActive = idx <= currentIdx && !isCancelled;
        const isCurrent = idx === currentIdx && !isCancelled;
        return (
          <div key={step.key} className="flex-1 flex flex-col items-center">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isCancelled
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : isActive
                  ? isCurrent
                    ? 'bg-blue-500 text-white ring-2 ring-blue-500/30'
                    : 'bg-green-500 text-white'
                  : 'bg-gray-700 text-gray-500 border border-gray-600'
              }`}
            >
              {isActive && !isCurrent ? '✓' : idx + 1}
            </div>
            <span className={`text-[10px] mt-1 text-center leading-tight ${
              isActive ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Main Customer Dashboard
// ============================================================
export default function CustomerDashboard() {
  const { user, logout } = useAuth();
  const { subscribe, unsubscribe } = usePusher();

  const [view, setView] = useState<View>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, waiting: 0, processing: 0, completed: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // New order form
  const [formData, setFormData] = useState({
    serviceType: '',
    description: '',
    requirements: '',
    deadline: '',
    price: '',
    phone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      const res = await authFetch(`/api/customer/orders?status=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Fetch orders error:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Real-time updates
  useEffect(() => {
    subscribe(CHANNELS.ORDERS, EVENTS.ORDER_STATUS_CHANGED, () => fetchOrders());
    subscribe(CHANNELS.ORDERS, EVENTS.ORDER_ACCEPTED, () => fetchOrders());
    subscribe(CHANNELS.ORDERS, EVENTS.ORDER_COMPLETED, () => fetchOrders());
    return () => {
      unsubscribe(CHANNELS.ORDERS);
    };
  }, [subscribe, unsubscribe, fetchOrders]);

  // Submit new order
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      const res = await authFetch('/api/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setFormSuccess(`Order ${data.order.orderNumber} berhasil dibuat! Sedang mencari penjoki...`);
        setFormData({ serviceType: '', description: '', requirements: '', deadline: '', price: '', phone: '' });
        setTimeout(() => {
          setView('orders');
          setFormSuccess('');
          fetchOrders();
        }, 2000);
      } else {
        setFormError(data.error || 'Gagal membuat order');
      }
    } catch {
      setFormError('Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  // ====================
  // ORDER DETAIL VIEW
  // ====================
  if (view === 'order-detail' && selectedOrder) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-md border-b border-gray-800">
          <div className="max-w-lg mx-auto flex items-center gap-3 p-4">
            <button onClick={() => { setView('orders'); setSelectedOrder(null); }} className="p-2 -ml-2 hover:bg-gray-800 rounded-xl transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold">#{selectedOrder.orderNumber}</h1>
              <p className="text-xs text-gray-400">{formatDate(selectedOrder.createdAt)}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColor(selectedOrder.status)}`}>
              {statusLabel(selectedOrder.status)}
            </span>
          </div>
        </div>

        <div className="max-w-lg mx-auto p-4 space-y-4">
          {/* Progress */}
          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Progress Order</h3>
            <OrderProgress status={selectedOrder.status} />
          </div>

          {/* Detail info */}
          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-5 space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Tipe Layanan</p>
              <p className="text-white font-medium">{selectedOrder.serviceType}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Deskripsi</p>
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{selectedOrder.description}</p>
            </div>
            {selectedOrder.requirements && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Persyaratan</p>
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{selectedOrder.requirements}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Harga</p>
                <p className="text-green-400 font-semibold">{formatCurrency(selectedOrder.price)}</p>
              </div>
              {selectedOrder.deadline && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Deadline</p>
                  <p className="text-yellow-400 text-sm">{formatDate(selectedOrder.deadline)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Penjoki info (if assigned) */}
          {selectedOrder.penjoki && (
            <div className="bg-gray-900/50 rounded-2xl border border-emerald-500/20 p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Penjoki yang Menangani</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{selectedOrder.penjoki.name}</p>
                  <div className="flex items-center gap-1 text-yellow-400 text-sm">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{selectedOrder.penjoki.rating.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Timeline</h3>
            <div className="space-y-3">
              <TimelineItem label="Order dibuat" date={selectedOrder.createdAt} active />
              {selectedOrder.assignedAt && (
                <TimelineItem label="Penjoki ditemukan" date={selectedOrder.assignedAt} active />
              )}
              {selectedOrder.startedAt && (
                <TimelineItem label="Mulai dikerjakan" date={selectedOrder.startedAt} active />
              )}
              {selectedOrder.completedAt && (
                <TimelineItem label="Selesai" date={selectedOrder.completedAt} active />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ====================
  // NEW ORDER FORM
  // ====================
  if (view === 'new-order') {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-md border-b border-gray-800">
          <div className="max-w-lg mx-auto flex items-center gap-3 p-4">
            <button onClick={() => { setView('orders'); setFormError(''); setFormSuccess(''); }} className="p-2 -ml-2 hover:bg-gray-800 rounded-xl transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold">Buat Order Baru</h1>
          </div>
        </div>

        <div className="max-w-lg mx-auto p-4">
          {formError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <p className="text-red-400 text-sm">{formError}</p>
            </div>
          )}
          {formSuccess && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <p className="text-green-400 text-sm">{formSuccess}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Service Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <FileText className="w-4 h-4 inline mr-1.5" />
                Tipe Layanan *
              </label>
              <select
                value={formData.serviceType}
                onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800/70 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition appearance-none"
                required
              >
                <option value="">Pilih tipe layanan...</option>
                {SERVICE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <FileText className="w-4 h-4 inline mr-1.5" />
                Deskripsi Tugas *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800/70 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                rows={4}
                placeholder="Jelaskan tugas yang ingin dikerjakan..."
                required
              />
            </div>

            {/* Requirements */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Persyaratan / Catatan
              </label>
              <textarea
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800/70 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                rows={3}
                placeholder="Format, referensi, atau catatan khusus..."
              />
            </div>

            {/* Price & Deadline */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Budget (Rp) *
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800/70 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="50000"
                  min="10000"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  <CalendarDays className="w-4 h-4 inline mr-1" />
                  Deadline
                </label>
                <input
                  type="datetime-local"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800/70 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                No. WhatsApp (opsional)
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800/70 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="08xxxxxxxxx"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Kirim Order
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ====================
  // ORDERS LIST (DEFAULT)
  // ====================
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-lg mx-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold">DoneFast</h1>
                <p className="text-xs text-gray-400">Halo, {user?.name} 👋</p>
              </div>
            </div>
            <button onClick={logout} className="p-2 hover:bg-gray-800 rounded-xl transition text-gray-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total', value: stats.total, color: 'text-white bg-gray-800' },
            { label: 'Proses', value: stats.waiting + stats.processing, color: 'text-blue-400 bg-blue-500/10' },
            { label: 'Selesai', value: stats.completed, color: 'text-green-400 bg-green-500/10' },
            { label: 'Batal', value: stats.cancelled, color: 'text-red-400 bg-red-500/10' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.color} rounded-xl p-3 text-center border border-gray-800`}>
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* New order button */}
        <button
          onClick={() => setView('new-order')}
          className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
        >
          <Plus className="w-5 h-5" />
          Buat Order Baru
        </button>

        {/* Filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {(['ALL', 'WAITING', 'PROCESSING', 'COMPLETED', 'CANCELLED'] as FilterStatus[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {f === 'ALL' ? 'Semua' : statusLabel(f)}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <div className="flex justify-end">
          <button
            onClick={() => { setLoading(true); fetchOrders(); }}
            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Memuat order...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">Belum ada order</p>
            <p className="text-gray-600 text-sm mt-1">Buat order pertamamu sekarang!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <button
                key={order.id}
                onClick={() => { setSelectedOrder(order); setView('order-detail'); }}
                className="w-full bg-gray-900/50 rounded-2xl border border-gray-800 p-4 text-left hover:bg-gray-800/50 hover:border-gray-700 transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500 font-mono">#{order.orderNumber}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border inline-flex items-center gap-1 ${statusColor(order.status)}`}>
                        {statusIcon(order.status)}
                        {statusLabel(order.status)}
                      </span>
                    </div>
                    <p className="font-medium text-white text-sm">{order.serviceType}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition mt-1" />
                </div>
                <p className="text-gray-400 text-xs line-clamp-2 mb-3">{order.description}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-green-400 font-medium">{formatCurrency(order.price)}</span>
                  <span className="text-gray-600">{formatDate(order.createdAt)}</span>
                </div>
                {order.penjoki && (
                  <div className="mt-2 pt-2 border-t border-gray-800 flex items-center gap-2 text-xs">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-gray-400">{order.penjoki.name}</span>
                    <Star className="w-3 h-3 text-yellow-400 fill-current ml-auto" />
                    <span className="text-yellow-400">{order.penjoki.rating.toFixed(1)}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Timeline item
// ============================================================
function TimelineItem({ label, date, active }: { label: string; date: string; active?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2.5 h-2.5 rounded-full ${active ? 'bg-blue-500' : 'bg-gray-700'}`} />
      <div className="flex-1">
        <p className={`text-sm ${active ? 'text-white' : 'text-gray-600'}`}>{label}</p>
      </div>
      <p className="text-xs text-gray-500">{formatDate(date)}</p>
    </div>
  );
}
