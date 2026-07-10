import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { Markup } from "./markupTypes";

const WS_URL = import.meta.env.VITE_REALTIME_URL || "ws://127.0.0.1:1234";

export function useCollabRoom(opts: {
  enabled: boolean;
  roomName: string | null;
  user: { id?: string; email?: string; name?: string | null } | null;
}) {
  const { enabled, roomName, user } = opts;
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState<
    Array<{ clientId: number; name: string; color: string; cursor?: { x: number; y: number } }>
  >([]);
  const [remoteMarkups, setRemoteMarkups] = useState<Markup[]>([]);
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const mapRef = useRef<Y.Map<Markup> | null>(null);

  useEffect(() => {
    if (!enabled || !roomName) return;
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(WS_URL, roomName, doc, {
      connect: true,
    });
    const map = doc.getMap<Markup>("markups");
    docRef.current = doc;
    providerRef.current = provider;
    mapRef.current = map;

    const syncFromMap = () => {
      const items: Markup[] = [];
      map.forEach((value) => items.push(value));
      setRemoteMarkups(items);
    };
    map.observe(syncFromMap);
    syncFromMap();

    provider.on("status", (e: { status: string }) => {
      setConnected(e.status === "connected");
    });

    const awareness = provider.awareness;
    awareness.setLocalStateField("user", {
      id: user?.id,
      name: user?.name || user?.email || "Anonymous",
      color: `#${Math.floor(Math.random() * 0xffffff)
        .toString(16)
        .padStart(6, "0")}`,
    });

    const onAwareness = () => {
      const states: Array<{
        clientId: number;
        name: string;
        color: string;
        cursor?: { x: number; y: number };
      }> = [];
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID) return;
        const u = state.user as { name?: string; color?: string } | undefined;
        states.push({
          clientId,
          name: u?.name || "Peer",
          color: u?.color || "#64748b",
          cursor: state.cursor as { x: number; y: number } | undefined,
        });
      });
      setPeers(states);
    };
    awareness.on("change", onAwareness);
    onAwareness();

    return () => {
      map.unobserve(syncFromMap);
      awareness.off("change", onAwareness);
      provider.destroy();
      doc.destroy();
      docRef.current = null;
      providerRef.current = null;
      mapRef.current = null;
      setConnected(false);
      setPeers([]);
    };
  }, [enabled, roomName, user?.id, user?.email, user?.name]);

  const publishMarkup = useMemo(
    () => (markup: Markup) => {
      mapRef.current?.set(markup.id, markup);
    },
    []
  );

  const setCursor = useMemo(
    () => (cursor: { x: number; y: number } | null) => {
      providerRef.current?.awareness.setLocalStateField("cursor", cursor);
    },
    []
  );

  return { connected, peers, remoteMarkups, publishMarkup, setCursor };
}
