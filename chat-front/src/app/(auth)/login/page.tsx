import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm/LoginForm";

// Suspense нужен форме: она читает ?next= из адреса (useSearchParams)
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
