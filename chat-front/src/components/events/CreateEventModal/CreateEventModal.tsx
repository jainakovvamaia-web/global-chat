import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button/Button";
import EmojiChoice from "@/components/ui/EmojiChoice/EmojiChoice";
import Modal from "@/components/ui/Modal/Modal";
import TextField, { TextArea } from "@/components/ui/TextField/TextField";
import { useCreateEvent } from "@/hooks/api/useEvents";
import { getErrorMessage } from "@/lib/api";
import styles from "./CreateEventModal.module.css";

const EVENT_EMOJIS = ["🎉", "⚽", "📚", "🎭", "✏️", "🎵", "🍕", "🧹", "🏀", "🎨"];

interface CreateEventModalProps {
  communityId: string;
  onClose: () => void;
}

type Errors = Partial<Record<"title" | "date" | "time" | "location" | "maxAttendees", string>>;

// Создание мероприятия (ТЗ, п. 5.7): название, описание, дата и время, место, лимит участников.
// TODO(backend): обложка события — загрузка изображения в Supabase Storage
export default function CreateEventModal({ communityId, onClose }: CreateEventModalProps) {
  const router = useRouter();
  const createEvent = useCreateEvent(communityId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [emoji, setEmoji] = useState(EVENT_EMOJIS[0]);
  const [errors, setErrors] = useState<Errors>({});

  const validate = (): Errors => {
    const result: Errors = {};
    if (!title.trim()) result.title = "Введи название";
    if (!date) result.date = "Выбери дату";
    if (!time) result.time = "Выбери время";
    if (date && time && new Date(`${date}T${time}`) < new Date()) result.date = "Дата уже прошла";
    if (!location.trim()) result.location = "Укажи место";
    if (maxAttendees && (!Number.isInteger(Number(maxAttendees)) || Number(maxAttendees) < 2)) {
      result.maxAttendees = "Минимум 2 участника";
    }
    return result;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    createEvent.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        emoji,
        startsAt: new Date(`${date}T${time}:00`).toISOString(), // местное время → UTC с часовым поясом
        location: location.trim(),
        maxAttendees: maxAttendees ? Number(maxAttendees) : null,
      },
      {
        onSuccess: (created) => {
          onClose();
          router.push(`/${communityId}/events/${created.id}`);
        },
        onError: (err) => setErrors({ title: getErrorMessage(err) }),
      },
    );
  };

  return (
    <Modal title="Новое событие" icon={emoji} onClose={onClose} size="md">
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Название"
          placeholder="например, Субботник во дворе"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={errors.title}
          autoFocus
        />
        <TextArea
          label="Описание"
          placeholder="Что будет и кого ждём"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className={styles.row}>
          <TextField label="Дата" type="date" value={date} onChange={(event) => setDate(event.target.value)} error={errors.date} />
          <TextField label="Время" type="time" value={time} onChange={(event) => setTime(event.target.value)} error={errors.time} />
        </div>
        <TextField
          label="Место"
          placeholder="например, Актовый зал"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          error={errors.location}
        />
        <TextField
          label="Максимум участников"
          type="number"
          min={2}
          placeholder="Без ограничений"
          value={maxAttendees}
          onChange={(event) => setMaxAttendees(event.target.value)}
          error={errors.maxAttendees}
        />
        <EmojiChoice label="Иконка" options={EVENT_EMOJIS} value={emoji} onChange={setEmoji} />
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit">Создать событие</Button>
        </div>
      </form>
    </Modal>
  );
}
