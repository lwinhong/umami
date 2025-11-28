import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { unauthorized, json } from '@/lib/response';
import { canViewWebsite } from '@/lib/auth';
import { getEventDataEventsCount } from '@/queries/sql/events/getEventDataEventsCount';
import { format } from 'date-fns';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    startAt: z.coerce.number().int(),
    endAt: z.coerce.number().int(),
    event: z.string().optional(),
    dataKey: z.string().optional(),
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { websiteId } = await params;
  const { event, dataKey, startAt, endAt } = query;

  if (!(await canViewWebsite(auth, websiteId))) {
    return unauthorized();
  }

  const startDate = new Date(+startAt);
  const endDate = new Date(+endAt);

  const data = await getEventDataEventsCount(websiteId, {
    startDate,
    endDate,
    event,
    dataKey,
  });

  const formatStr = 'yyyy-MM-dd';
  const formattedData = data.map(item => {
    item.event_date = format(new Date(item.event_date), formatStr);
    return item;
  });

  return json(formattedData);
}
