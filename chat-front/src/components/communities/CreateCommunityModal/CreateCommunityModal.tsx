import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Button from "@/components/ui/Button/Button";
import EmojiChoice from "@/components/ui/EmojiChoice/EmojiChoice";
import Modal from "@/components/ui/Modal/Modal";
import TextField, { SelectField } from "@/components/ui/TextField/TextField";
import { CATEGORY_LABELS } from "@/lib/communities";
import { useCreateCommunity } from "@/hooks/api/useCommunities";
import { getErrorMessage } from "@/lib/api";
import type { CommunityCategory } from "@/types";
import styles from "./CreateCommunityModal.module.css";

const COMMUNITY_EMOJIS = ["🏫", "🎓", "🏠", "🏙️", "💼", "📚", "⚙️", "⛵", "🌳", "🎨"];
const CATEGORIES = Object.keys(CATEGORY_LABELS) as CommunityCategory[];
const CATEGORY_NAMES = CATEGORIES.map((category) => CATEGORY_LABELS[category]);

// Создание сообщества (ТЗ, п. 5.2): создатель становится владельцем,
// а каналы по умолчанию (#general, #announcements, ...) создаются автоматически.
export default function CreateCommunityModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const createCommunity = useCreateCommunity();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryName, setCategoryName] = useState(CATEGORY_NAMES[0]);
  const [emoji, setEmoji] = useState(COMMUNITY_EMOJIS[0]);
  const [isPrivate, setIsPrivate] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const category = CATEGORIES[CATEGORY_NAMES.indexOf(categoryName)];
    createCommunity.mutate(
      { name: name.trim(), description: description.trim() || "Новое сообщество", category, emoji, isPrivate },
      {
        onSuccess: (community) => {
          onClose();
          router.push(`/${community.id}/chat/general`);
        },
      },
    );
  };

  return (
    <Modal title="Новое сообщество" icon={emoji} onClose={onClose} size="md">
      <form className={styles.form} onSubmit={handleSubmit}>
        <TextField
          label="Название"
          placeholder="например, Лицей №2"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          error={createCommunity.isError ? getErrorMessage(createCommunity.error) : undefined}
        />
        <TextField
          label="Описание"
          placeholder="Кто здесь общается"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <SelectField
          label="Категория"
          options={CATEGORY_NAMES}
          value={categoryName}
          onChange={(event) => setCategoryName(event.target.value)}
        />
        <EmojiChoice label="Иконка" options={COMMUNITY_EMOJIS} value={emoji} onChange={setEmoji} />
        <label className={styles.checkbox}>
          <input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} />
          Закрытое сообщество — вступление по коду приглашения или заявке
        </label>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={!name.trim() || createCommunity.isPending}>
            Создать сообщество
          </Button>
        </div>
      </form>
    </Modal>
  );
}
