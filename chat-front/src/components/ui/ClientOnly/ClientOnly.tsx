"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};

// Показывает содержимое только в браузере, а на сервере — заглушку (fallback).
// Нужен для экранов с данными из клиентского store: время «10 мин назад» на сервере
// и в браузере считается в разные моменты, и React выдал бы ошибку несовпадения (hydration).
export default function ClientOnly({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return isClient ? children : fallback;
}
