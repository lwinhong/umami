import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { unauthorized, json } from '@/lib/response';
import { canViewWebsite } from '@/lib/auth';
import { getEventDataEventsByEventName } from '@/queries/sql/events/getEventDataEventsByEventName';
import { format } from 'date-fns';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    // startAt: z.coerce.number().int(),
    // endAt: z.coerce.number().int(),
    event: z.string().optional(),
    // timezone: z.string().optional(),
    dataKey: z.string().optional(),
    stringValue: z.string().optional(),
    page: z.coerce.number().int().optional(),
    limit: z.coerce.number().int().optional(),
  });
  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { websiteId } = await params;
  const { event, dataKey, stringValue, page, limit } = query;

  if (!(await canViewWebsite(auth, websiteId))) {
    return unauthorized();
  }

  // const startDate = new Date(+startAt);
  // const endDate = new Date(+endAt);

  const data = await getEventDataEventsByEventName(websiteId, {
    // startDate,
    // endDate,
    // timezone,
    event,
    stringValue,
    page: Number(page || 1),
    limit: Number(limit || 100),
    dataKey,
  });
  const formatStr = 'yyyy-MM-dd HH:mm:ss';
  const formattedData = data.map(item => {
    const newItem = {
      created_at: format(new Date(item.created_at), formatStr),
    };
    if (item.event_data?.length) {
      for (let i = 0; i < item.event_data.length; i++) {
        const element = item.event_data[i];
        newItem[element.data_key] = element.string_value;
      }
    }
    return newItem;
  });
  const total = data?.[0]?.total || 0;
  return json({ total, data: formattedData });
}
