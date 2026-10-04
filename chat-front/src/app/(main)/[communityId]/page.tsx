import { redirect } from "next/navigation";

// По ТЗ после входа в сообщество пользователь попадает в общий чат #general
export default async function CommunityPage({ params }: PageProps<"/[communityId]">) {
  const { communityId } = await params;
  redirect(`/${communityId}/chat/general`);
}
