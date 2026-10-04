import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button/Button";
import Modal from "@/components/ui/Modal/Modal";
import TextField, { SelectField } from "@/components/ui/TextField/TextField";
import { useCreateChat } from "@/hooks/api/useChats";
import { useCities, useDistricts, useInstitutions } from "@/hooks/api/useEducation";
import { useCreateChatInvitation } from "@/hooks/api/useInvitations";
import { getErrorMessage } from "@/lib/api";
import { getInstitutionLabel } from "@/lib/locations";
import type { ChatAccessType, ChatType, GroupChat } from "@/types";
import adminStyles from "@/components/admin/AdminView/AdminView.module.css";
import formStyles from "@/components/communities/CreateCommunityModal/CreateCommunityModal.module.css";
import InvitationOptionsFields from "../ChatInvitesModal/InvitationOptionsFields";
import { toInvitationInput, type ExpiryValue, type MaxUsesValue } from "../ChatInvitesModal/invitationOptions";

const TYPE_OPTIONS: { value: ChatType; label: string }[] = [
  { value: "general", label: "Общая — для всех" },
  { value: "city", label: "Город" },
  { value: "district", label: "Район" },
  { value: "school", label: "Школа" },
  { value: "university", label: "Университет" },
  { value: "local", label: "«Рядом» — в этом сообществе" },
];

const ACCESS_OPTIONS: { value: ChatAccessType; label: string }[] = [
  { value: "public", label: "Открытая — по месту из профиля" },
  { value: "private", label: "Закрытая — только по коду приглашения" },
];

// Какие привязки нужны типу группы (то же правило проверяют сервер и база)
const NEEDS = {
  general: { city: false, district: false, institution: false },
  city: { city: true, district: false, institution: false },
  district: { city: true, district: true, institution: false },
  school: { city: true, district: true, institution: true },
  university: { city: true, district: true, institution: true },
  local: { city: false, district: false, institution: false },
} as const;

interface CreateChatModalProps {
  communityId: string; // текущее сообщество: в нём откроется группа, к нему привязывается тип «Рядом»
  onClose: () => void;
}

// «Создать группу» — только для администратора платформы (кнопку видит только он,
// а сервер ещё раз проверяет роль по базе)
export default function CreateChatModal({ communityId, onClose }: CreateChatModalProps) {
  const router = useRouter();
  const createChat = useCreateChat();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ChatType>("general");
  const [cityId, setCityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [access, setAccess] = useState<ChatAccessType>("public");
  const [expiry, setExpiry] = useState<ExpiryValue>("7d");
  const [maxUses, setMaxUses] = useState<MaxUsesValue>("10");
  const [error, setError] = useState("");
  // Закрытая группа создана — показываем её первый код приглашения
  const [result, setResult] = useState<{ chat: GroupChat; code: string | null } | null>(null);

  const needs = NEEDS[type];
  const institutionType = type === "school" || type === "university" ? type : "";
  const cities = useCities();
  const districts = useDistricts(needs.district ? cityId : "");
  const institutions = useInstitutions(needs.institution ? districtId : "", institutionType);
  const createInvitation = useCreateChatInvitation(result?.chat.id ?? "");

  const chatHref = (chat: GroupChat) =>
    chat.type === "local"
      ? `/${communityId}/nearby/${chat.id}`
      : `/${communityId}/chat/place/${encodeURIComponent(chat.id)}`;

  const validate = (): string | null => {
    if (name.trim().length < 2) return "Название — минимум 2 символа";
    if (needs.city && !cityId) return "Выберите город";
    if (needs.district && !districtId) return "Выберите район";
    if (needs.institution && !institutionId) return "Выберите учебное заведение";
    return null;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    createChat.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        type,
        cityId: needs.city ? cityId : null,
        districtId: needs.district ? districtId : null,
        institutionId: needs.institution ? institutionId : null,
        communityId: type === "local" ? communityId : null,
        access,
      },
      {
        onSuccess: (chat) => {
          if (access === "public") {
            onClose();
            router.push(chatHref(chat));
            return;
          }
          setResult({ chat, code: null });
        },
        onError: (err) => setError(getErrorMessage(err)),
      },
    );
  };

  // Шаг 2 для закрытой группы: сразу выдать код приглашения
  if (result) {
    return (
      <Modal title="Группа создана" description={result.chat.name} icon="🔒" onClose={onClose} size="md">
        <div className={adminStyles.inviteResult}>
          {result.code ? (
            <>
              <div className={adminStyles.inviteCode}>{result.code}</div>
              <Button variant="soft" fullWidth onClick={() => void navigator.clipboard?.writeText(result.code ?? "")}>
                Скопировать код
              </Button>
            </>
          ) : (
            <>
              <p className={adminStyles.muted}>Создайте код приглашения — по нему участники войдут в группу</p>
              <InvitationOptionsFields
                expiry={expiry}
                maxUses={maxUses}
                onExpiryChange={setExpiry}
                onMaxUsesChange={setMaxUses}
              />
              <Button
                fullWidth
                disabled={createInvitation.isPending}
                onClick={() =>
                  createInvitation.mutate(toInvitationInput(expiry, maxUses), {
                    onSuccess: (invitation) => setResult({ ...result, code: invitation.code }),
                    onError: (err) => setError(getErrorMessage(err)),
                  })
                }
              >
                Создать код приглашения
              </Button>
            </>
          )}
          {error && (
            <p className={adminStyles.muted} role="alert">
              ⚠️ {error}
            </p>
          )}
          <Button variant="secondary" fullWidth onClick={() => router.push(chatHref(result.chat))}>
            Открыть группу
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Создать группу" description="Видно только администраторам" icon="👥" onClose={onClose} size="md">
      <form className={formStyles.form} onSubmit={handleSubmit}>
        <TextField
          label="Название"
          placeholder="например, Студенты КНУ"
          value={name}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
        <TextField
          label="Описание"
          placeholder="О чём эта группа"
          value={description}
          maxLength={300}
          onChange={(event) => setDescription(event.target.value)}
        />
        <SelectField
          label="Тип"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(event) => {
            setType(event.target.value as ChatType);
            setInstitutionId("");
          }}
        />
        {needs.city && (
          <SelectField
            label="Город"
            placeholder={cities.isLoading ? "Загрузка…" : "Выберите город"}
            options={(cities.data ?? []).map((city) => ({ value: city.id, label: city.name }))}
            value={cityId}
            onChange={(event) => {
              setCityId(event.target.value);
              setDistrictId("");
              setInstitutionId("");
            }}
          />
        )}
        {needs.district && (
          <SelectField
            label="Район"
            placeholder={cityId ? "Выберите район" : "Сначала выберите город"}
            options={(districts.data ?? []).map((district) => ({ value: district.id, label: district.name }))}
            value={districtId}
            disabled={!cityId}
            onChange={(event) => {
              setDistrictId(event.target.value);
              setInstitutionId("");
            }}
          />
        )}
        {needs.institution && (
          <SelectField
            label={type === "school" ? "Школа" : "Университет"}
            placeholder={districtId ? "Выберите учебное заведение" : "Сначала выберите район"}
            options={(institutions.data ?? []).map((item) => ({ value: item.id, label: getInstitutionLabel(item) }))}
            value={institutionId}
            disabled={!districtId}
            onChange={(event) => setInstitutionId(event.target.value)}
          />
        )}
        <SelectField
          label="Доступ"
          options={ACCESS_OPTIONS}
          value={access}
          onChange={(event) => setAccess(event.target.value as ChatAccessType)}
          hint={
            access === "private"
              ? "Группу увидят только участники. После создания вы получите код приглашения."
              : "Группу автоматически увидят все, кому она подходит по профилю."
          }
        />

        {error && (
          <p className={adminStyles.muted} role="alert">
            ⚠️ {error}
          </p>
        )}

        <div className={formStyles.actions}>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={createChat.isPending}>
            Создать группу
          </Button>
        </div>
      </form>
    </Modal>
  );
}
