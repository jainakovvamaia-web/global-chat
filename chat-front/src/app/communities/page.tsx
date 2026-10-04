import CommunitySelect from "@/components/communities/CommunitySelect/CommunitySelect";
import RequireAuth from "@/components/providers/RequireAuth";

// «Мои чаты» — сюда попадают после входа и регистрации.
// Список приходит с сервера по профилю пользователя, поэтому страница только для вошедших.
export default function CommunitiesPage() {
  return (
    <RequireAuth fallback={null}>
      <CommunitySelect />
    </RequireAuth>
  );
}
