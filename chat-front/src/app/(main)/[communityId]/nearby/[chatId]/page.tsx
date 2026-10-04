import LocalChatView from "@/components/nearby/LocalChatView/LocalChatView";

export default async function LocalChatPage({ params }: PageProps<"/[communityId]/nearby/[chatId]">) {
  const { chatId } = await params;
  // key сбрасывает состояние (ответ на сообщение) при переходе в другой чат
  return <LocalChatView key={chatId} chatId={chatId} />;
}
