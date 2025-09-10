import prisma from '@/lib/prisma';
import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import { QueryFilters, WebsiteEventData } from '@/lib/types';

export async function getEventDataEventsDate(
  ...args: [websiteId: string, filters: QueryFilters]
): Promise<WebsiteEventData[]> {
  return runQuery({
    [PRISMA]: () => relationalQuery(...args),
    [CLICKHOUSE]: () => clickhouseQuery(...args),
  });
}

async function relationalQuery(websiteId: string, filters: QueryFilters) {
  const { rawQuery, parseFilters } = prisma;
  const { event } = filters;
  const { params } = await parseFilters(websiteId, filters);

  if (event) {
    return rawQuery(
      `
      select
        DATE(DATE_TRUNC('day', event_data.created_at AT TIME ZONE 'UTC' AT TIME ZONE {{timezone}} )) AS event_date,
        COUNT(event_data.STRING_VALUE) as count,
        event_data.STRING_VALUE as string_value
      from event_data
      inner join website_event
        on website_event.event_id = event_data.website_event_id
      where event_data.website_id = {{websiteId::uuid}}
        and event_data.created_at between {{startDate}} and {{endDate}}
        and website_event.event_name = {{event}}
        ${params.dataKey ? ' and event_data.DATA_KEY = {{dataKey}}' : ''}
      group by event_date, string_value
      order by EVENT_DATE asc
      `,
      params,
    );
  }

  return rawQuery(
    `
    select
        DATE(DATE_TRUNC('day', event_data.created_at AT TIME ZONE 'UTC' AT TIME ZONE {{timezone}} )) AS event_date,
        COUNT(event_data.STRING_VALUE) as count,
        event_data.STRING_VALUE as string_value
      from event_data
      inner join website_event
        on website_event.event_id = event_data.website_event_id
      where event_data.website_id = {{websiteId::uuid}}
        and event_data.created_at between {{startDate}} and {{endDate}}
        ${params.dataKey ? ' and event_data.DATA_KEY = {{dataKey}}' : ''}
      group by event_date, string_value
      order by EVENT_DATE asc
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
