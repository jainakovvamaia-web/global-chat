import { useEffect, useState, type ReactNode } from "react";
import { useMarkChannelRead } from "@/hooks/api/useCommunities";
import { useDeleteMessage, useMessages, useSendMessage, useToggleReaction } from "@/hooks/api/useMessages";
import { useTypingIndicator } from "@/hooks/useRealtime";
import { getErrorMessage } from "@/lib/api";
import type { Message } from "@/types";
import ChatHeader from "../ChatHeader/ChatHeader";
import type { ChatRoomInfo } from "../chatRoom";
import MessageComposer from "../MessageComposer/MessageComposer";
import MessageList from "../MessageList/MessageList";
import TypingIndicator from "../TypingIndicator/TypingIndicator";
import styles from "./ChatView.module.css";

// Область сообщений: шапка, история и поле ввода. Одна и та же для каналов и чатов по месту.
// Сообщения приходят с сервера; новые — по сигналу Supabase Realtime (см. useMessages).
export default function ChatView({
  room,
  communityId,
  headerActions,
}: {
  room: ChatRoomInfo;
  communityId: string;
  headerActions?: ReactNode;
}) {
  const messagesQuery = useMessages(room.target);
  const sendMessage = useSendMessage(room.target);
  const toggleReaction = useToggleReaction(room.target);
  const deleteMessage = useDeleteMessage(room.target);
  const markChannelRead = useMarkChannelRead(communityId);
  const typing = useTypingIndicator(room.target);

  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState<string | null>(null); // null — поиск закрыт

  const roomMessages = messagesQuery.messages;
  const query = searchQuery?.trim().toLowerCase() ?? "";
  const visibleMessages = query
    ? roomMessages.filter((message) => message.content.toLowerCase().includes(query))
    : roomMessages;

  // Открыли канал или пришли новые сообщения — отмечаем канал прочитанным на сервере
  const channelId = room.target.kind === "channel" ? room.target.id : null;
  const lastMessageId = roomMessages.at(-1)?.id;
  const { mutate: markRead } = markChannelRead;
  useEffect(() => {
    if (channelId) markRead(channelId);
  }, [channelId, lastMessageId, markRead]);

  const actionError = sendMessage.error ?? toggleReaction.error ?? deleteMessage.error;

  return (
    <section className={styles.chat} aria-label={`Чат ${room.title}`}>
      <ChatHeader
        room={room}
        searchQuery={searchQuery}
        resultsCount={query ? visibleMessages.length : null}
        onSearchChange={setSearchQuery}
        extraActions={headerActions}
      />

      <MessageList
        messages={visibleMessages}
        isSearching={Boolean(query)}
        isLoading={messagesQuery.isLoading}
        loadError={messagesQuery.error ? getErrorMessage(messagesQuery.error) : null}
        hasOlder={messagesQuery.hasNextPage}
        isLoadingOlder={messagesQuery.isFetchingNextPage}
        onLoadOlder={() => void messagesQuery.fetchNextPage()}
        onReply={setReplyTo}
        onReact={(messageId, emoji) => toggleReaction.mutate({ messageId, emoji })}
        onDelete={(messageId) => deleteMessage.mutate(messageId)}
      />

      {actionError && (
        <p className={styles.readOnly} role="alert">
          {getErrorMessage(actionError)}
        </p>
      )}

      <TypingIndicator count={typing.typingCount} />

      {room.canPost ? (
        <MessageComposer
          placeholder={room.placeholder}
          replyTo={replyTo}
          replyAuthorName={replyTo?.author.displayName}
          onCancelReply={() => setReplyTo(null)}
          onTyping={typing.notify}
          onSend={(text, replyToId) => {
            typing.stop();
            sendMessage.mutate({ content: text.trim(), replyToId });
          }}
        />
      ) : (
        <p className={styles.readOnly}>{room.readOnlyNote}</p>
      )}
    </section>
  );
}
