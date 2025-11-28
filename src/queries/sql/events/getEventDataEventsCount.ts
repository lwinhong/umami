import prisma from '@/lib/prisma';
import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import { QueryFilters, WebsiteEventData } from '@/lib/types';

export async function getEventDataEventsCount(
  ...args: [websiteId: string, filters: QueryFilters]
): Promise<WebsiteEventData[]> {
  return runQuery({
    [PRISMA]: () => relationalQuery(...args),
    [CLICKHOUSE]: () => clickhouseQuery(...args),
  });
}

async function relationalQuery(websiteId: string, filters: QueryFilters) {
  const { rawQuery, parseFilters } = prisma;
  const { params } = await parseFilters(websiteId, filters);

  return rawQuery(
    `
        SELECT 
            DATE(DATE_TRUNC('day', event_data.created_at)) AS event_date,
            COUNT(DISTINCT event_data.STRING_VALUE) as count
        FROM event_data
        WHERE website_event_id IN (
            SELECT event_id FROM website_event 
            WHERE event_name = ANY(string_to_array({{event}}, ',')) and WEBSITE_ID = {{websiteId::uuid}} 
            AND created_at BETWEEN {{startDate}} and {{endDate}}
        ) 
        AND data_key = ANY(string_to_array({{dataKey}}, ','))
        GROUP BY event_date
        ORDER BY event_date;
      `,
    params,
  );
}

async function clickhouseQuery(
  websiteId: string,
  filters: QueryFilters,
): Promise<{ eventName: string; propertyName: string; dataType: number; total: number }[]> {
  const { rawQuery, parseFilters } = clickhouse;
  const { event } = filters;
  const { params } = await parseFilters(websiteId, filters);

  if (event) {
    return rawQuery(
      `
      select
        event_name as eventName,
        data_key as propertyName,
        data_type as dataType,
        string_value as propertyValue,
        count(*) as total
      from event_data
      where website_id = {websiteId:UUID}
        and created_at between {startDate:DateTime64} and {endDate:DateTime64}
        and event_name = {event:String}
      group by data_key, data_type, string_value, event_name
      order by 1 asc, 2 asc, 3 asc, 5 desc
      limit 500
      `,
      params,
    );
  }

  return rawQuery(
    `
    select
      event_name as eventName,
      data_key as propertyName,
      data_type as dataType,
      count(*) as total
    from event_data
    where website_id = {websiteId:UUID}
      and created_at between {startDate:DateTime64} and {endDate:DateTime64}
    group by data_key, data_type, event_name
    order by 1 asc, 2 asc
    limit 500
    `,
    params,
  );
}
