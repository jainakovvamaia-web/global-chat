"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Lightbulb, Send } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader/PageHeader";
import { useAskAi } from "@/hooks/api/useAi";
import { useCurrentCommunity } from "@/hooks/useCurrentCommunity";
import { getErrorMessage } from "@/lib/api";
import styles from "./AiAssistantView.module.css";

// Примеры вопросов для первого экрана
const AI_SUGGESTIONS = [
  "Что обсуждали вчера в #general?",
  "Сделай краткое резюме последних сообщений",
  "Какие мероприятия запланированы на этой неделе?",
  "Найди сообщение о потерянном рюкзаке",
  "Покажи последние объявления",
];

interface AiMessage {
  id: number;
  role: "user" | "ai";
  text: string;
}

// AI-помощник (ТЗ, п. 5.9): POST /api/ai/ask. Сервер ищет только по сообщениям этого сообщества,
// доступным пользователю, и не передаёт модели никаких данных об авторах.
export default function AiAssistantView() {
  const { communityId } = useCurrentCommunity();
  const askAi = useAskAi(communityId);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [query, setQuery] = useState("");
  // search — на сервере не задан ключ AI: ответ собран простым поиском по словам
  const [mode, setMode] = useState<"ai" | "search" | null>(null);
  const isThinking = askAi.isPending;
  const bottomRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  // Прокрутка к последнему ответу
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, isThinking]);

  const addMessage = (role: AiMessage["role"], text: string) => {
    nextId.current += 1;
    const id = nextId.current;
    setMessages((prev) => [...prev, { id, role, text }]);
  };

  const ask = (text: string) => {
    const question = text.trim();
    if (question.length < 2 || isThinking) return;
    addMessage("user", question);
    setQuery("");
    askAi.mutate(question, {
      onSuccess: (result) => {
        setMode(result.mode);
        addMessage("ai", result.answer);
      },
      onError: (error) => addMessage("ai", `⚠️ ${getErrorMessage(error)}`),
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    ask(query);
  };

  return (
    <section className={styles.page}>
      <PageHeader
        icon={
          <span className={styles.logo} aria-hidden="true">
            <Lightbulb size={16} />
          </span>
        }
        title="Community AI"
        subtitle="Ищет по истории сообщений сообщества"
      />

      <div className={styles.body}>
        {messages.length === 0 && (
          <div className={styles.intro}>
            <div className={styles.introIcon} aria-hidden="true">
              🤖
            </div>
            <h2 className={styles.introTitle}>Привет! Я Community AI</h2>
            <p className={styles.introText}>
              Я могу найти информацию в истории сообщений, сделать резюме обсуждений и ответить на вопросы о
              сообществе
            </p>
            <p className={styles.suggestionsTitle}>Попробуй спросить</p>
            <div className={styles.suggestions}>
              {AI_SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" className={styles.suggestion} onClick={() => ask(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "search" && (
          <div className={styles.warning}>
            ⚠️ AI-ключ на сервере не настроен: показываю найденные сообщения без пересказа.
          </div>
        )}

        <div className={styles.messages} aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={message.role === "user" ? styles.rowUser : styles.rowAi}>
              {message.role === "ai" && (
                <span className={styles.aiBadge} aria-hidden="true">
                  AI
                </span>
              )}
              <div className={message.role === "user" ? styles.bubbleUser : styles.bubbleAi}>{message.text}</div>
            </div>
          ))}
          {isThinking && (
            <div className={styles.rowAi}>
              <span className={styles.aiBadge} aria-hidden="true">
                AI
              </span>
              <div className={`${styles.bubbleAi} ${styles.typing}`} aria-label="Помощник печатает">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form className={styles.composer} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <input
            className={styles.input}
            placeholder="Задай вопрос о сообществе..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Вопрос помощнику"
          />
          <button
            type="submit"
            className={`${styles.send} ${query.trim() && !isThinking ? styles.sendActive : ""}`}
            disabled={!query.trim() || isThinking}
            aria-label="Спросить"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </section>
  );
}
