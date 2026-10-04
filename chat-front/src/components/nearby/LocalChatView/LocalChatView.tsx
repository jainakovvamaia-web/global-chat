"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ChatInvitesModal from "@/components/chat/ChatInvitesModal/ChatInvitesModal";
import MessageComposer from "@/components/chat/MessageComposer/MessageComposer";
import MessageList from "@/components/chat/MessageList/MessageList";
import Button from "@/components/ui/Button/Button";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import PageHeader from "@/components/ui/PageHeader/PageHeader";
import { useLocalChat, useToggleLocalChatJoin } from "@/hooks/api/useChats";
import { useDeleteMessage, useMessages, useSendMessage, useToggleReaction } from "@/hooks/api/useMessages";
import { useCurrentCommunity } from "@/hooks/useCurrentCommunity";
import { useTypingIndicator } from "@/hooks/useRealtime";
import TypingIndicator from "@/components/chat/TypingIndicator/TypingIndicator";
import { getErrorMessage } from "@/lib/api";
import type { Message } from "@/types";
import styles from "./LocalChatView.module.css";

// Локальный чат места: информация о месте, переписка, вступление и выход.
// Доступ к чату и сообщениям проверяет сервер (только участники сообщества).
export default function LocalChatView({ chatId }: { chatId: string }) {
  const { communityId } = useCurrentCommunity();
  const chatQuery = useLocalChat(chatId);
  const toggleJoin = useToggleLocalChatJoin(communityId);
  const target = { kind: "chat", id: chatId } as const;
  const messagesQuery = useMessages(target);
  const sendMessage = useSendMessage(target);
  const toggleReaction = useToggleReaction(target);
  const deleteMessage = useDeleteMessage(target);
  const typing = useTypingIndicator(target);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const router = useRouter();

  const chat = chatQuery.data;

  if (chatQuery.isLoading) return null;

  if (!chat || chat.communityId !== communityId) {
    return (
      <div className={styles.notFound}>
        <EmptyState
          emoji="📍"
          title="Чат не найден"
          action={<Button href={`/${communityId}/nearby`}>К списку чатов</Button>}
        />
      </div>
    );
  }

  const actionError = toggleJoin.error ?? sendMessage.error ?? toggleReaction.error ?? deleteMessage.error;

  return (
    <section className={styles.page} aria-label={chat.name}>
      <PageHeader
        backHref={`/${communityId}/nearby`}
        icon={
          <span className={styles.emoji} aria-hidden="true">
            {chat.emoji ?? "📍"}
          </span>
        }
        title={chat.name}
        subtitle={`${chat.membersCount} участников · ${chat.onlineCount} онлайн`}
        actions={
          <>
            {/* Создатель группы и admin: приглашения и удаление (права проверяет сервер) */}
            {chat.canManage && (
              <Button variant="soft" size="xs" onClick={() => setIsManageOpen(true)}>
                {chat.access === "private" ? "Пригласить" : "Управление"}
              </Button>
            )}
            <Button
              variant={chat.joined ? "danger" : "primary"}
              size="xs"
              disabled={toggleJoin.isPending}
              onClick={() => toggleJoin.mutate(chat)}
            >
              {chat.joined ? "Покинуть" : "Вступить"}
            </Button>
          </>
        }
      />

      <MessageList
        messages={messagesQuery.messages}
        isSearching={false}
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
        <p className={styles.joinHint} role="alert">
          {getErrorMessage(actionError)}
        </p>
      )}

      <TypingIndicator count={typing.typingCount} />

      {chat.joined ? (
        <MessageComposer
          placeholder={`Написать в ${chat.name}...`}
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
        <p className={styles.joinHint}>Вступи в чат, чтобы писать сообщения</p>
      )}

      {isManageOpen && (
        <ChatInvitesModal
          chat={{ ...chat, emoji: chat.emoji ?? "📍" }}
          onClose={() => setIsManageOpen(false)}
          onDeleted={() => router.push(`/${communityId}/nearby`)}
        />
      )}
    </section>
  );
}
