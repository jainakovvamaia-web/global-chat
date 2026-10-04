import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { FaceSlightlySmiling, Paperclip, Send, X } from "lucide-react";
import EmojiPicker from "@/components/ui/EmojiPicker/EmojiPicker";
import { useDismiss } from "@/hooks/useDismiss";
import type { Message } from "@/types";
import styles from "./MessageComposer.module.css";

const MAX_TEXTAREA_HEIGHT = 128;

interface MessageComposerProps {
  placeholder: string;
  replyTo: Message | null;
  replyAuthorName: string | undefined; // имя автора цитаты — уже анонимизированное для зрителя
  onCancelReply: () => void;
  onSend: (text: string, replyToId: string | null) => void;
  onTyping?: () => void; // человек вводит текст — для индикатора «печатает…» (WebSocket)
}

// Поле ввода сообщения — одно и то же для каналов и локальных чатов
export default function MessageComposer({
  placeholder,
  replyTo,
  replyAuthorName,
  onCancelReply,
  onSend,
  onTyping,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const closePicker = useCallback(() => setIsPickerOpen(false), []);
  useDismiss(pickerRef, isPickerOpen, closePicker);

  const canSend = text.trim().length > 0;

  // Нажали «Ответить» — переводим курсор в поле ввода
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  // Поле растёт вместе с текстом, но не выше MAX_TEXTAREA_HEIGHT
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [text]);

  const handleSend = () => {
    if (!canSend) return;
    onSend(text, replyTo?.id ?? null);
    setText("");
    onCancelReply();
    textareaRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  // Вставляем эмодзи туда, где стоит курсор
  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? text.length;
    const end = textarea?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    closePicker();
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  return (
    <div className={styles.composer}>
      {replyTo && (
        <div className={styles.replyBar}>
          <div className={styles.replyText}>
            Ответ <strong>{replyAuthorName ?? "на сообщение"}</strong>: {replyTo.content}
          </div>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onCancelReply}
            aria-label="Отменить ответ"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className={styles.field}>
        {/* TODO(backend): вложения требуют Supabase Storage — включим после подключения сервера */}
        <button
          type="button"
          className={styles.iconButton}
          disabled
          title="Вложения появятся после подключения сервера"
          aria-label="Прикрепить файл (скоро)"
        >
          <Paperclip size={20} />
        </button>

        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder={placeholder}
          rows={1}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (event.target.value.trim()) onTyping?.();
          }}
          onKeyDown={handleKeyDown}
          aria-label="Текст сообщения"
        />

        <div className={styles.pickerWrapper} ref={pickerRef}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setIsPickerOpen((open) => !open)}
            aria-label="Вставить эмодзи"
            aria-expanded={isPickerOpen}
          >
            <FaceSlightlySmiling size={20} />
          </button>
          {isPickerOpen && <EmojiPicker onSelect={insertEmoji} className={styles.picker} />}
        </div>

        <button
          type="button"
          className={`${styles.sendButton} ${canSend ? styles.sendButtonActive : ""}`}
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Отправить"
        >
          <Send size={16} />
        </button>
      </div>

      <p className={styles.hint}>Enter — отправить · Shift+Enter — новая строка</p>
    </div>
  );
}
