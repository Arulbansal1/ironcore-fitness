import { redirect } from 'next/navigation';

/**
 * Admins use the same full-featured ticket workspace as staff rather than a
 * parallel implementation that could drift out of sync.
 */
export default async function AdminTicketRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/staff/tickets/${id}`);
}
