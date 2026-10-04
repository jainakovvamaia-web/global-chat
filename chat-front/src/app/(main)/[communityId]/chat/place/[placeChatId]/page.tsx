import PlaceChatScreen from "@/components/chat/PlaceChatScreen/PlaceChatScreen";

// Чат по месту из профиля: город, район или учебное заведение
export default async function PlaceChatPage({
  params,
}: PageProps<"/[communityId]/chat/place/[placeChatId]">) {
  const { placeChatId } = await params;
  return <PlaceChatScreen placeChatId={decodeURIComponent(placeChatId)} />;
}
