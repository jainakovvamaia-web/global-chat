import { useState } from "react";
import { Lock } from "lucide-react";
import Button from "@/components/ui/Button/Button";
import { useProfile, useUpdateProfile } from "@/hooks/api/useProfile";
import { getErrorMessage } from "@/lib/api";
import { getFullName } from "@/lib/identity";
import { INSTITUTION_TYPE_LABELS, validateLocation, type LocationErrors } from "@/lib/locations";
import type { LocationSelection } from "@/types";
import LocationEducationFields from "../LocationEducationFields/LocationEducationFields";
import styles from "./PersonalDataCard.module.css";

// Личные данные из регистрации. Видны только владельцу — в чатах он «Анонимно».
// Смена города, района или учебного заведения сразу меняет список «Мои чаты».
export default function PersonalDataCard() {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const [draft, setDraft] = useState<LocationSelection | null>(null); // null — режим просмотра
  const [errors, setErrors] = useState<LocationErrors>({});

  if (!profile) return null;

  // Названия мест присылает сервер вместе с профилем
  const names = profile.locationNames;
  const institutionType = profile.location.institutionType;
  const rows = [
    { label: "Имя и фамилия", value: getFullName(profile) },
    { label: "Email", value: profile.email },
    { label: "Город", value: names.city },
    { label: "Район", value: names.district },
    { label: "Тип учебного заведения", value: institutionType ? INSTITUTION_TYPE_LABELS[institutionType] : null },
    { label: "Учебное заведение", value: names.institution },
    // Заведение выбирается из списка своего района — район у них общий
    { label: "Район учебного заведения", value: names.institution ? names.district : null },
  ];

  const changeDraft = (next: LocationSelection) => {
    setDraft(next);
    // Ошибки уже показаны — пересчитываем их, чтобы исправленные поля сразу очищались
    if (Object.keys(errors).length > 0) setErrors(validateLocation(next));
  };

  const save = () => {
    if (!draft) return;
    const nextErrors = validateLocation(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    updateProfile.mutate({ location: draft }, { onSuccess: () => setDraft(null) });
  };

  const cancel = () => {
    setDraft(null);
    setErrors({});
    updateProfile.reset();
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Личные данные</h3>
        {!draft && (
          <Button variant="ghost" size="xs" onClick={() => setDraft(profile.location)}>
            Изменить место и учёбу
          </Button>
        )}
      </div>
      <p className={styles.privacy}>
        <Lock size={12} aria-hidden="true" /> Видны только вам. В чатах вы отображаетесь как «Анонимно».
      </p>

      {draft ? (
        <div className={styles.edit}>
          <LocationEducationFields value={draft} onChange={changeDraft} errors={errors} />
          <p className={styles.hint}>
            {updateProfile.isError
              ? `⚠️ ${getErrorMessage(updateProfile.error)}`
              : "После сохранения список «Мои чаты» обновится."}
          </p>
          <div className={styles.actions}>
            <Button variant="secondary" size="sm" onClick={cancel}>
              Отмена
            </Button>
            <Button size="sm" onClick={save} disabled={updateProfile.isPending}>
              Сохранить
            </Button>
          </div>
        </div>
      ) : (
        <dl className={styles.list}>
          {rows.map((row) => (
            <div key={row.label} className={styles.row}>
              <dt>{row.label}</dt>
              <dd>{row.value || <span className={styles.empty}>не указано</span>}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
