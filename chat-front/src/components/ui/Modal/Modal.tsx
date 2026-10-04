import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./Modal.module.css";

interface ModalProps {
  title: string;
  description?: string;
  icon?: string; // эмодзи в плашке над заголовком, как в макете
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md";
}

// Модальное окно: закрывается по крестику, клику по фону и клавише Escape
export default function Modal({ title, description, icon, onClose, children, size = "sm" }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.dialog} ${styles[size]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
          <X size={18} />
        </button>
        <div className={styles.header}>
          {icon && (
            <div className={styles.icon} aria-hidden="true">
              {icon}
            </div>
          )}
          <h2 id="modal-title" className={styles.title}>
            {title}
          </h2>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
