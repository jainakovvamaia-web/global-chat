import { useState, type FormEvent } from "react";
import Button from "@/components/ui/Button/Button";
import EmojiChoice from "@/components/ui/EmojiChoice/EmojiChoice";
import Modal from "@/components/ui/Modal/Modal";
import TextField from "@/components/ui/TextField/TextField";
import { useCreateChannel, useUpdateChannel } from "@/hooks/api/useCommunities";
import { getErrorMessage } from "@/lib/api";
import type { Channel } from "@/types";
import styles from "./ChannelFormModal.module.css";

const CHANNEL_EMOJIS = ["💬", "📢", "🔍", "🎉", "😂", "📚", "⚽", "🎨", "💡", "🧪", "🎵", "📌"];

interface ChannelFormModalProps {
  communityId: string;
  channel?: Channel; // если передан — редактирование, иначе создание
  onClose: () => void;
}

// Создание и редактирование канала (ТЗ, п. 5.4): название, описание, иконка, права на отправку
export default function ChannelFormModal({ communityId, channel, onClose }: ChannelFormModalProps) {
  const createChannel = useCreateChannel(communityId);
  const updateChannel = useUpdateChannel(communityId);
  const isSaving = createChannel.isPending || updateChannel.isPending;

  const [name, setName] = useState(channel?.name ?? "");
  const [description, setDescription] = useState(channel?.description ?? "");
  const [emoji, setEmoji] = useState(channel?.emoji ?? CHANNEL_EMOJIS[0]);
  const [isAnnouncements, setIsAnnouncements] = useState(channel?.isAnnouncements ?? false);
  const [error, setError] = useState("");
  const isGeneral = channel?.name === "general";

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const input = { name, description: description.trim(), emoji, isAnnouncements };
    const options = { onSuccess: onClose, onError: (err: unknown) => setError(getErrorMessage(err)) };
    if (channel) updateChannel.mutate({ ...input, id: channel.id }, options);
    else createChannel.mutate(input, options);
  };

  return (
    <Modal title={channel ? "Изменить канал" : "Новый канал"} icon={emoji} onClose={onClose} size="md">
      <form className={styles.form} onSubmit={handleSubmit}>
        <TextField
          label="Название"
          placeholder="например, sport"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          error={error}
          hint={
            isGeneral
              ? "#general — основной канал сообщества, его название менять нельзя"
              : "Строчные буквы, цифры и дефисы — пробелы заменятся на дефис"
          }
          disabled={isGeneral}
          autoFocus
        />
        <TextField
          label="Описание"
          placeholder="О чём этот канал"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <EmojiChoice label="Иконка" options={CHANNEL_EMOJIS} value={emoji} onChange={setEmoji} />

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={isAnnouncements}
            onChange={(event) => setIsAnnouncements(event.target.checked)}
          />
          Канал объявлений — писать могут только администраторы и модераторы
        </label>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={!name.trim() || isSaving}>
            {channel ? "Сохранить" : "Создать канал"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
