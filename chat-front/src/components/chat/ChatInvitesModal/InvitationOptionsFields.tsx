import { SelectField } from "@/components/ui/TextField/TextField";
import { EXPIRY_OPTIONS, MAX_USES_OPTIONS, type ExpiryValue, type MaxUsesValue } from "./invitationOptions";
import styles from "./ChatInvitesModal.module.css";

interface InvitationOptionsFieldsProps {
  expiry: ExpiryValue;
  maxUses: MaxUsesValue;
  onExpiryChange: (value: ExpiryValue) => void;
  onMaxUsesChange: (value: MaxUsesValue) => void;
}

// Срок действия и лимит использований кода — в окне группы и при создании закрытой группы
export default function InvitationOptionsFields({
  expiry,
  maxUses,
  onExpiryChange,
  onMaxUsesChange,
}: InvitationOptionsFieldsProps) {
  return (
    <div className={styles.options}>
      <SelectField
        label="Срок действия"
        options={EXPIRY_OPTIONS}
        value={expiry}
        onChange={(event) => onExpiryChange(event.target.value as ExpiryValue)}
      />
      <SelectField
        label="Сколько раз можно использовать"
        options={MAX_USES_OPTIONS}
        value={maxUses}
        onChange={(event) => onMaxUsesChange(event.target.value as MaxUsesValue)}
      />
    </div>
  );
}
