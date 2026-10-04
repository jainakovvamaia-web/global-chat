import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "./TextField.module.css";

interface FieldWrapperProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

// Подпись, поле и текст ошибки/подсказки — общая обёртка для всех полей формы
function FieldWrapper({ id, label, error, hint, children }: FieldWrapperProps) {
  return (
    <div>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-message`} className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-message`} className={styles.hint}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export default function TextField({ label, error, hint, type = "text", className = "", ...rest }: TextFieldProps) {
  const id = useId();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <FieldWrapper id={id} label={label} error={error} hint={hint}>
      <div className={styles.inputWrapper}>
        <input
          id={id}
          type={isPassword && isPasswordVisible ? "text" : type}
          className={`${styles.input} ${error ? styles.invalid : ""} ${isPassword ? styles.withToggle : ""} ${className}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? `${id}-message` : undefined}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setIsPasswordVisible((visible) => !visible)}
            aria-label={isPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
          >
            {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </FieldWrapper>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextArea({ label, error, hint, className = "", ...rest }: TextAreaProps) {
  const id = useId();
  return (
    <FieldWrapper id={id} label={label} error={error} hint={hint}>
      <textarea
        id={id}
        className={`${styles.input} ${styles.textarea} ${error ? styles.invalid : ""} ${className}`}
        aria-invalid={Boolean(error)}
        {...rest}
      />
    </FieldWrapper>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: readonly (string | SelectOption)[]; // строка — значение и подпись совпадают
  placeholder?: string; // пустой пункт «не выбрано» — показывается первым
  error?: string;
  hint?: string;
}

export function SelectField({
  label,
  options,
  placeholder,
  error,
  hint,
  className = "",
  ...rest
}: SelectFieldProps) {
  const id = useId();
  return (
    <FieldWrapper id={id} label={label} error={error} hint={hint}>
      <select
        id={id}
        className={`${styles.input} ${styles.select} ${error ? styles.invalid : ""} ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? `${id}-message` : undefined}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => {
          const { value, label: optionLabel } = typeof option === "string" ? { value: option, label: option } : option;
          return (
            <option key={value} value={value}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </FieldWrapper>
  );
}
