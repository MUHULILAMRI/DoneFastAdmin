import Pusher from 'pusher';
import PusherClient from 'pusher-js';

// Server-side Pusher instance
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

// Client-side Pusher instance (singleton)
let pusherClientInstance: PusherClient | null = null;

export const getPusherClient = (): PusherClient => {
  if (!pusherClientInstance) {
    pusherClientInstance = new PusherClient(
      process.env.NEXT_PUBLIC_PUSHER_KEY!,
      {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
        forceTLS: true,
      }
    );
  }
  return pusherClientInstance;
};

// Channel names
export const CHANNELS = {
  ORDERS: 'orders',
  PENJOKI: (id: string) => `private-penjoki-${id}`,
  ADMIN: 'private-admin',
  DISTRIBUTION: 'distribution',
} as const;

// Event names
export const EVENTS = {
  NEW_ORDER: 'new-order',
  ORDER_ASSIGNED: 'order-assigned',
  ORDER_OFFER: 'order-offer',
  ORDER_ACCEPTED: 'order-accepted',
  ORDER_REJECTED: 'order-rejected',
  ORDER_TIMEOUT: 'order-timeout',
  ORDER_STATUS_CHANGED: 'order-status-changed',
  ORDER_COMPLETED: 'order-completed',
  PENJOKI_STATUS_CHANGED: 'penjoki-status-changed',
  DISTRIBUTION_UPDATE: 'distribution-update',
  STATS_UPDATE: 'stats-update',
} as const;
