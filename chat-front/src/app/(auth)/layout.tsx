import type { ReactNode } from "react";
import AuthLayout from "@/components/auth/AuthLayout/AuthLayout";

// Общая раскладка для входа, регистрации и восстановления пароля
export default function Layout({ children }: { children: ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
