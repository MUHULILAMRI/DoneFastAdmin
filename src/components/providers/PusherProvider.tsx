'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import PusherClient from 'pusher-js';
import { useAuth } from './AuthProvider';

interface PusherContextValue {
  pusher: PusherClient | null;
  isConnected: boolean;
  subscribe: (channelName: string, eventName: string, callback: (data: unknown) => void) => void;
  unsubscribe: (channelName: string) => void;
}

const PusherContext = createContext<PusherContextValue | null>(null);

export function PusherProvider({ children }: { children: ReactNode }) {
  const [pusher, setPusher] = useState<PusherClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();
  const pusherRef = useRef<PusherClient | null>(null);

  useEffect(() => {
    if (!user) return;

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!key || !cluster) {
      console.warn('Pusher credentials not configured. Real-time features disabled.');
      return;
    }

    const client = new PusherClient(key, {
      cluster,
      forceTLS: true,
      channelAuthorization: {
        endpoint: '/api/pusher/auth',
        transport: 'ajax',
      },
    });

    client.connection.bind('connected', () => {
      setIsConnected(true);
      console.log('[Pusher] Connected');
    });

    client.connection.bind('disconnected', () => {
      setIsConnected(false);
      console.log('[Pusher] Disconnected');
    });

    client.connection.bind('error', (err: unknown) => {
      console.error('[Pusher] Error:', err);
    });

    pusherRef.current = client;
    setPusher(client);

    return () => {
      client.disconnect();
      pusherRef.current = null;
    };
  }, [user]);

  const subscribe = useCallback((channelName: string, eventName: string, callback: (data: unknown) => void) => {
    if (!pusherRef.current) return;

    const channel = pusherRef.current.subscribe(channelName);
    channel.bind(eventName, callback);
  }, []);

  const unsubscribe = useCallback((channelName: string) => {
    if (!pusherRef.current) return;
    pusherRef.current.unsubscribe(channelName);
  }, []);

  return (
    <PusherContext.Provider value={{ pusher, isConnected, subscribe, unsubscribe }}>
      {children}
    </PusherContext.Provider>
  );
}

export function usePusher() {
  const context = useContext(PusherContext);
  if (!context) throw new Error('usePusher must be used within PusherProvider');
  return context;
}
