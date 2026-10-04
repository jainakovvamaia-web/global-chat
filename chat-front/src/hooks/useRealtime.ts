// React-обёртки над единым WebSocket-соединением (lib/realtime.ts).
// Компоненты только подписываются на нужные чаты — соединение одно на всё приложение.

import { useEffect, useRef, useState } from "react";
import { getRealtime, topicOf, type RealtimeTarget } from "@/lib/realtime";

// Подписка на чат/канал, пока компонент на экране. Смена чата = отписка от старого и подписка
// на новый; соединение при этом не пересоздаётся.
export function useRealtimeTopic(target: RealtimeTarget | null): void {
  const kind = target?.kind;
  const id = target?.id;
  useEffect(() => {
    if (!kind || !id) return;
    return getRealtime().subscribe({ kind, id });
  }, [kind, id]);
}

// Подписка сразу на несколько мест (например, на все каналы сообщества — для счётчиков непрочитанных)
export function useRealtimeTopics(targets: RealtimeTarget[]): void {
  const key = targets.map(topicOf).sort().join(",");
  useEffect(() => {
    if (!key) return;
    const realtime = getRealtime();
    const unsubscribers = key.split(",").map((topic) => {
      const separator = topic.indexOf(":");
      const kind = topic.slice(0, separator) as RealtimeTarget["kind"];
      return realtime.subscribe({ kind, id: topic.slice(separator + 1) });
    });
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [key]);
}

const TYPING_REPEAT_MS = 3_000; // сервер держит «печатает» 6 с — повторяем, пока человек пишет
const TYPING_IDLE_MS = 4_000; // перестал печатать — гасим индикатор
const TYPING_STALE_MS = 8_000; // страховка, если typing_stop потерялся

// «Анонимно печатает…»: сколько других людей пишет в этом чате + функции для поля ввода.
// Личность печатающего сервер не сообщает — только количество.
export function useTypingIndicator(target: RealtimeTarget) {
  const { kind, id } = target;
  const [typingCount, setTypingCount] = useState(0);
  const lastSent = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const topic = topicOf({ kind, id });
    let staleTimer: ReturnType<typeof setTimeout> | null = null;
    const off = getRealtime().on((event) => {
      if (!("target" in event) || !event.target || topicOf(event.target) !== topic) return;
      if (event.type === "typing_start") {
        setTypingCount(event.count);
        if (staleTimer) clearTimeout(staleTimer);
        staleTimer = setTimeout(() => setTypingCount(0), TYPING_STALE_MS);
      } else if (event.type === "typing_stop" || event.type === "unsubscribed_chat") {
        setTypingCount(0);
      } else if (event.type === "new_message" && !event.message.isMine) {
        // Человек отправил сообщение — его индикатор погаснет; дождёмся точного счёта от сервера
        setTypingCount((count) => Math.max(0, count - 1));
      }
    });
    return () => {
      off();
      if (staleTimer) clearTimeout(staleTimer);
      setTypingCount(0);
    };
  }, [kind, id]);

  const stop = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    if (lastSent.current) {
      lastSent.current = 0;
      getRealtime().typing({ kind, id }, false);
    }
  };

  // Вызывается при каждом вводе символа; на сервер — не чаще раза в 3 секунды
  const notify = () => {
    const now = Date.now();
    if (now - lastSent.current > TYPING_REPEAT_MS) {
      lastSent.current = now;
      getRealtime().typing({ kind, id }, true);
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stop, TYPING_IDLE_MS);
  };

  // Ушли из чата — гасим свой индикатор
  useEffect(() => {
    const timers = idleTimer;
    const sent = lastSent;
    return () => {
      if (timers.current) clearTimeout(timers.current);
      timers.current = null;
      if (sent.current) {
        sent.current = 0;
        getRealtime().typing({ kind, id }, false);
      }
    };
  }, [kind, id]);

  return { typingCount, notify, stop };
}
