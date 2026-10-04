import ChannelScreen from "@/components/chat/ChannelScreen/ChannelScreen";

export default async function ChannelPage({ params }: PageProps<"/[communityId]/chat/[channelName]">) {
  const { channelName } = await params;
  // decodeURIComponent: название канала может быть на кириллице
  return <ChannelScreen channelName={decodeURIComponent(channelName)} />;
}
