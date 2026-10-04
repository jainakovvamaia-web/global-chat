import ChannelSidebar from "@/components/chat/ChannelSidebar/ChannelSidebar";

// Раздел «Чат»: список каналов слева, выбранный канал справа
export default function ChatLayout({ children }: LayoutProps<"/[communityId]/chat">) {
  return (
    <>
      <ChannelSidebar />
      {children}
    </>
  );
}
