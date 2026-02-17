'use client';

import { useState, useEffect, useCallback, FormEvent, useRef } from 'react';
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
  Bell,
  X,
  Ban,
  MessageSquare,
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
  customerRating?: number;
  customerReview?: string;
  ratedAt?: string;
  cancelReason?: string;
  cancelledAt?: string;
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

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
  time: Date;
  read: boolean;
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
// Skeleton Loading Components
// ============================================================
function SkeletonPulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800 rounded-lg ${className}`} />;
}

function OrderCardSkeleton() {
  return (
    <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <SkeletonPulse className="h-4 w-20" />
            <SkeletonPulse className="h-5 w-24 rounded-full" />
          </div>
          <SkeletonPulse className="h-4 w-40" />
        </div>
        <SkeletonPulse className="h-4 w-4 rounded" />
      </div>
      <SkeletonPulse className="h-3 w-full" />
      <SkeletonPulse className="h-3 w-3/4" />
      <div className="flex items-center justify-between">
        <SkeletonPulse className="h-4 w-24" />
        <SkeletonPulse className="h-3 w-32" />
      </div>
    </div>
  );
}

function StatsCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-xl p-3 text-center border border-gray-800">
      <SkeletonPulse className="h-7 w-8 mx-auto mb-1" />
      <SkeletonPulse className="h-3 w-12 mx-auto" />
    </div>
  );
}

// ============================================================
// Rating Modal Component
// ============================================================
function RatingModal({
  order,
  onClose,
  onSubmit,
}: {
  order: Order;
  onClose: () => void;
  onSubmit: (rating: number, review: string) => Promise<void>;
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    await onSubmit(rating, review);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Beri Rating</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-lg transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Order info */}
        <div className="bg-gray-800/50 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Order #{order.orderNumber}</p>
          <p className="text-sm text-white font-medium">{order.serviceType}</p>
          {order.penjoki && (
            <p className="text-xs text-gray-400 mt-1">Penjoki: {order.penjoki.name}</p>
          )}
        </div>

        {/* Stars */}
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-400">Bagaimana pengalamanmu?</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform hover:scale-125"
              >
                <Star
                  className={`w-9 h-9 transition-colors ${
                    star <= (hoverRating || rating)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-600'
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {rating === 1 && 'Buruk'}
            {rating === 2 && 'Kurang'}
            {rating === 3 && 'Cukup'}
            {rating === 4 && 'Bagus'}
            {rating === 5 && 'Sangat Bagus!'}
          </p>
        </div>

        {/* Review text */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Komentar (opsional)</label>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-800/70 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-transparent transition resize-none text-sm"
            rows={3}
            placeholder="Ceritakan pengalamanmu..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700 transition font-medium text-sm"
          >
            Nanti
          </button>
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="flex-1 py-2.5 bg-yellow-500 text-black rounded-xl hover:bg-yellow-400 transition font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Star className="w-4 h-4" />
                Kirim Rating
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Cancel Confirmation Modal
// ============================================================
function CancelModal({
  order,
  onClose,
  onConfirm,
}: {
  order: Order;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasons = [
    'Tidak jadi mengerjakan',
    'Menemukan orang lain',
    'Budget berubah',
    'Deadline berubah',
  ];

  const handleConfirm = async () => {
    setSubmitting(true);
    await onConfirm(reason || 'Dibatalkan oleh customer');
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Batalkan Order?</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-lg transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Warning */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-400 text-sm font-medium">Perhatian</p>
            <p className="text-red-400/70 text-xs mt-1">
              Order #{order.orderNumber} akan dibatalkan. Tindakan ini tidak bisa dibatalkan.
            </p>
          </div>
        </div>

        {/* Quick reasons */}
        <div>
          <p className="text-sm text-gray-400 mb-2">Alasan pembatalan:</p>
          <div className="flex flex-wrap gap-2">
            {reasons.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                  reason === r
                    ? 'bg-red-500/15 text-red-400 border-red-500/30'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full mt-3 px-3 py-2.5 bg-gray-800/70 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-transparent transition resize-none text-sm"
            rows={2}
            placeholder="Atau tulis alasan lain..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700 transition font-medium text-sm"
          >
            Kembali
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-500 transition font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Ban className="w-4 h-4" />
                Ya, Batalkan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
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

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Modals
  const [ratingOrder, setRatingOrder] = useState<Order | null>(null);
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);

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
      const params = new URLSearchParams();
      params.set('status', filter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await authFetch(`/api/customer/orders?${params.toString()}`);
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
  }, [filter, searchQuery]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Real-time updates with notifications
  const addNotification = useCallback((message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const notif: Notification = {
      id: Date.now().toString(),
      message,
      type,
      time: new Date(),
      read: false,
    };
    setNotifications(prev => [notif, ...prev].slice(0, 20));
  }, []);

  useEffect(() => {
    subscribe(CHANNELS.ORDERS, EVENTS.ORDER_STATUS_CHANGED, (raw: unknown) => {
      const data = raw as { orderId?: string; status?: string; message?: string } | undefined;
      fetchOrders();
      if (data?.message) {
        addNotification(data.message, data.status === 'CANCELLED' ? 'warning' : 'info');
      }
    });
    subscribe(CHANNELS.ORDERS, EVENTS.ORDER_ACCEPTED, (raw: unknown) => {
      const data = raw as { orderNumber?: string } | undefined;
      fetchOrders();
      addNotification(`Order ${data?.orderNumber || ''} sudah diterima penjoki! 🎉`, 'success');
    });
    subscribe(CHANNELS.ORDERS, EVENTS.ORDER_COMPLETED, (raw: unknown) => {
      const data = raw as { orderNumber?: string } | undefined;
      fetchOrders();
      addNotification(`Order ${data?.orderNumber || ''} sudah selesai dikerjakan! ✅`, 'success');
    });
    return () => {
      unsubscribe(CHANNELS.ORDERS);
    };
  }, [subscribe, unsubscribe, fetchOrders, addNotification]);

  // Cancel order handler
  const handleCancelOrder = async (reason: string) => {
    if (!cancelOrder) return;
    try {
      const res = await authFetch('/api/customer/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: cancelOrder.id, action: 'cancel', reason }),
      });
      if (res.ok) {
        addNotification(`Order #${cancelOrder.orderNumber} berhasil dibatalkan`, 'warning');
        setCancelOrder(null);
        fetchOrders();
        if (view === 'order-detail') {
          setView('orders');
          setSelectedOrder(null);
        }
      }
    } catch (err) {
      console.error('Cancel error:', err);
    }
  };

  // Rate order handler
  const handleRateOrder = async (rating: number, review: string) => {
    if (!ratingOrder) return;
    try {
      const res = await authFetch('/api/customer/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: ratingOrder.id, action: 'rate', rating, review }),
      });
      if (res.ok) {
        addNotification(`Terima kasih atas rating ${rating} ⭐`, 'success');
        setRatingOrder(null);
        fetchOrders();
      }
    } catch (err) {
      console.error('Rate error:', err);
    }
  };

  const unreadNotifCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

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
    const canCancel = ['WAITING', 'SEARCHING'].includes(selectedOrder.status);
    const canRate = selectedOrder.status === 'COMPLETED' && !selectedOrder.customerRating;

    return (
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Modals */}
        {ratingOrder && <RatingModal order={ratingOrder} onClose={() => setRatingOrder(null)} onSubmit={handleRateOrder} />}
        {cancelOrder && <CancelModal order={cancelOrder} onClose={() => setCancelOrder(null)} onConfirm={handleCancelOrder} />}

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

          {/* Action buttons: Rate or Cancel */}
          {(canRate || canCancel) && (
            <div className="flex gap-3">
              {canRate && (
                <button
                  onClick={() => setRatingOrder(selectedOrder)}
                  className="flex-1 py-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-xl hover:bg-yellow-500/20 transition font-medium text-sm flex items-center justify-center gap-2"
                >
                  <Star className="w-4 h-4" />
                  Beri Rating
                </button>
              )}
              {canCancel && (
                <button
                  onClick={() => setCancelOrder(selectedOrder)}
                  className="flex-1 py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/20 transition font-medium text-sm flex items-center justify-center gap-2"
                >
                  <Ban className="w-4 h-4" />
                  Batalkan Order
                </button>
              )}
            </div>
          )}

          {/* Rating display (if rated) */}
          {selectedOrder.customerRating && (
            <div className="bg-yellow-500/5 rounded-2xl border border-yellow-500/20 p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Rating Anda</h3>
              <div className="flex items-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${
                      star <= selectedOrder.customerRating!
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-600'
                    }`}
                  />
                ))}
                <span className="ml-2 text-yellow-400 font-medium text-sm">{selectedOrder.customerRating}/5</span>
              </div>
              {selectedOrder.customerReview && (
                <div className="flex items-start gap-2 mt-2">
                  <MessageSquare className="w-3.5 h-3.5 text-gray-500 mt-0.5" />
                  <p className="text-gray-400 text-sm italic">&quot;{selectedOrder.customerReview}&quot;</p>
                </div>
              )}
            </div>
          )}

          {/* Cancel reason (if cancelled) */}
          {selectedOrder.status === 'CANCELLED' && selectedOrder.cancelReason && (
            <div className="bg-red-500/5 rounded-2xl border border-red-500/20 p-5">
              <h3 className="text-sm font-medium text-red-400 mb-1">Alasan Pembatalan</h3>
              <p className="text-gray-400 text-sm">{selectedOrder.cancelReason}</p>
            </div>
          )}

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
              {selectedOrder.cancelledAt && (
                <TimelineItem label="Dibatalkan" date={selectedOrder.cancelledAt} active />
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
      {/* Modals */}
      {ratingOrder && <RatingModal order={ratingOrder} onClose={() => setRatingOrder(null)} onSubmit={handleRateOrder} />}
      {cancelOrder && <CancelModal order={cancelOrder} onClose={() => setCancelOrder(null)} onConfirm={handleCancelOrder} />}

      {/* Notification Panel */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setShowNotifications(false)}>
          <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-gray-900 border-l border-gray-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-white">Notifikasi</h2>
              <div className="flex items-center gap-2">
                {unreadNotifCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300 transition">
                    Tandai semua dibaca
                  </button>
                )}
                <button onClick={() => setShowNotifications(false)} className="p-1.5 hover:bg-gray-800 rounded-lg transition">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto h-[calc(100%-60px)]">
              {notifications.length === 0 ? (
                <div className="text-center py-16">
                  <Bell className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Belum ada notifikasi</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 hover:bg-gray-800/50 transition ${
                        !notif.read ? 'bg-blue-500/5 border-l-2 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          notif.type === 'success' ? 'bg-green-500' :
                          notif.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-300">{notif.message}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {new Date(notif.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
            <div className="flex items-center gap-1">
              {/* Search toggle */}
              <button
                onClick={() => {
                  setShowSearch(!showSearch);
                  if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 100);
                }}
                className={`p-2 rounded-xl transition ${showSearch ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                <Search className="w-5 h-5" />
              </button>
              {/* Notification bell */}
              <button
                onClick={() => { setShowNotifications(true); markAllRead(); }}
                className="p-2 hover:bg-gray-800 rounded-xl transition text-gray-400 hover:text-white relative"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>
              <button onClick={logout} className="p-2 hover:bg-gray-800 rounded-xl transition text-gray-400 hover:text-white">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search bar (collapsible) */}
          {showSearch && (
            <div className="mb-1 animate-in slide-in-from-top">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setLoading(true); fetchOrders(); } }}
                  placeholder="Cari order, layanan, deskripsi..."
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-800/70 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setLoading(true); fetchOrders(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-gray-500 hover:text-gray-300" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Stats cards */}
        {loading ? (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatsCardSkeleton key={i} />
            ))}
          </div>
        ) : (
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
        )}

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
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <OrderCardSkeleton key={i} />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">{searchQuery ? 'Tidak ditemukan' : 'Belum ada order'}</p>
            <p className="text-gray-600 text-sm mt-1">
              {searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : 'Buat order pertamamu sekarang!'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <div
                key={order.id}
                className="w-full bg-gray-900/50 rounded-2xl border border-gray-800 hover:bg-gray-800/50 hover:border-gray-700 transition-all group"
              >
                <button
                  onClick={() => { setSelectedOrder(order); setView('order-detail'); }}
                  className="w-full p-4 text-left"
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

                  {/* Customer rating display */}
                  {order.customerRating && (
                    <div className="mt-2 pt-2 border-t border-gray-800 flex items-center gap-1 text-xs">
                      <span className="text-gray-500 mr-1">Rating Anda:</span>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3 h-3 ${s <= order.customerRating! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-700'}`} />
                      ))}
                    </div>
                  )}
                </button>

                {/* Quick action buttons on cards */}
                {(order.status === 'COMPLETED' && !order.customerRating) || ['WAITING', 'SEARCHING'].includes(order.status) ? (
                  <div className="px-4 pb-3 flex gap-2">
                    {order.status === 'COMPLETED' && !order.customerRating && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setRatingOrder(order); }}
                        className="flex-1 py-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-xl hover:bg-yellow-500/20 transition text-xs font-medium flex items-center justify-center gap-1.5"
                      >
                        <Star className="w-3.5 h-3.5" />
                        Beri Rating
                      </button>
                    )}
                    {['WAITING', 'SEARCHING'].includes(order.status) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setCancelOrder(order); }}
                        className="flex-1 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition text-xs font-medium flex items-center justify-center gap-1.5"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Batalkan
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
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
