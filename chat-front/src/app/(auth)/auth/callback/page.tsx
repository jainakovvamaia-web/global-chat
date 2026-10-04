import AuthCallback from "@/components/auth/AuthCallback/AuthCallback";

// Сюда Supabase возвращает после входа через Google и после подтверждения email
export default function AuthCallbackPage() {
  return <AuthCallback />;
}
