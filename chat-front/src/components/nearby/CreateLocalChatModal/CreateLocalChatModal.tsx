import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button/Button";
import Modal from "@/components/ui/Modal/Modal";
import TextField from "@/components/ui/TextField/TextField";
import { useCreateLocalChat } from "@/hooks/api/useChats";
import { getErrorMessage } from "@/lib/api";
import styles from "./CreateLocalChatModal.module.css";

// Типы мест из ТЗ (п. 5.5): дом, подъезд, двор, библиотека, площадка, корпус...
const PLACE_TYPES = [
  { emoji: "🏠", label: "Дом" },
  { emoji: "🚪", label: "Подъезд" },
  { emoji: "🌳", label: "Двор" },
  { emoji: "📚", label: "Библиотека" },
  { emoji: "⚽", label: "Спорт" },
  { emoji: "🍽️", label: "Столовая" },
  { emoji: "🏢", label: "Корпус" },
  { emoji: "📍", label: "Другое" },
];

interface CreateLocalChatModalProps {
  communityId: string;
  onClose: () => void;
}

export default function CreateLocalChatModal({ communityId, onClose }: CreateLocalChatModalProps) {
  const router = useRouter();
  const createLocalChat = useCreateLocalChat(communityId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState(PLACE_TYPES[0].emoji);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2 || createLocalChat.isPending) return;
    createLocalChat.mutate(
      { name: name.trim(), description: description.trim() || "Локальный чат сообщества", emoji },
      {
        onSuccess: (chat) => {
          onClose();
          router.push(`/${communityId}/nearby/${chat.id}`);
        },
      },
    );
  };

  return (
    <Modal title="Новый локальный чат" description="Чат привязан к месту, а не к вашей геолокации" icon={emoji} onClose={onClose} size="md">
      <form className={styles.form} onSubmit={handleSubmit}>
        <TextField
          label="Название места"
          placeholder="например, Корпус Б"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={createLocalChat.isError ? getErrorMessage(createLocalChat.error) : undefined}
          autoFocus
        />
        <TextField
          label="Описание"
          placeholder="Кто здесь общается"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Тип места</legend>
          <div className={styles.types}>
            {PLACE_TYPES.map((type) => (
              <button
                key={type.emoji}
                type="button"
                className={`${styles.type} ${type.emoji === emoji ? styles.typeActive : ""}`}
                onClick={() => setEmoji(type.emoji)}
                aria-pressed={type.emoji === emoji}
              >
                <span aria-hidden="true">{type.emoji}</span>
                {type.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={name.trim().length < 2 || createLocalChat.isPending}>
            Создать чат
          </Button>
        </div>
      </form>
    </Modal>
  );
}
