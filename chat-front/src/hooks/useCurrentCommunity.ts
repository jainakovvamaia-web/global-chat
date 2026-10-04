import { useParams } from "next/navigation";
import { useCommunity, useMembers } from "@/hooks/api/useCommunities";
import type { Member } from "@/types";

// Постоянная пустая ссылка, пока участники не загружены
const EMPTY_MEMBERS: Member[] = [];

// Текущее сообщество из адреса (/bishkek/...), его участники (анонимно) и роль вошедшего пользователя
export function useCurrentCommunity() {
  const { communityId } = useParams<{ communityId: string }>();
  const communityQuery = useCommunity(communityId);
  const community = communityQuery.data;
  const membersQuery = useMembers(communityId, community?.joined === true);

  return {
    communityId,
    community,
    communityQuery,
    members: membersQuery.data ?? EMPTY_MEMBERS,
    membersQuery,
    myRole: community?.myRole ?? undefined,
  };
}
