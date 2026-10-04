import { redirect } from "next/navigation";

export default async function ChatIndexPage({ params }: PageProps<"/[communityId]/chat">) {
  const { communityId } = await params;
  redirect(`/${communityId}/chat/general`);
}
