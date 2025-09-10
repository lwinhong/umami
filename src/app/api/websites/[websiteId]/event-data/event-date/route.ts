import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { unauthorized, json } from '@/lib/response';
import { canViewWebsite } from '@/lib/auth';
import { getEventDataEventsDate } from '@/queries/sql/events/getEventDataEventsDate';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    startAt: z.coerce.number().int(),
    endAt: z.coerce.number().int(),
    event: z.string().optional(),
    timezone: z.string().optional(),
    dataKey: z.string().optional(),
  });
  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { websiteId } = await params;
  const { startAt, endAt, event, timezone, dataKey } = query;

  if (!(await canViewWebsite(auth, websiteId))) {
    return unauthorized();
  }

  const startDate = new Date(+startAt);
  const endDate = new Date(+endAt);

  const data = await getEventDataEventsDate(websiteId, {
    startDate,
    endDate,
    event,
    timezone,
    dataKey,
  });

  const formattedData = data.map(item => ({
    ...item,
    event_date: new Date(item.event_date).toISOString().split('T')[0],
  }));

  return json(formattedData);
}
