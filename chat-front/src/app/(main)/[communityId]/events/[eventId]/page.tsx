import EventDetails from "@/components/events/EventDetails/EventDetails";

export default async function EventPage({ params }: PageProps<"/[communityId]/events/[eventId]">) {
  const { eventId } = await params;
  return <EventDetails eventId={eventId} />;
}
