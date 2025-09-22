import prisma from '@/lib/prisma';
import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import { QueryFilters, WebsiteEventData } from '@/lib/types';

export async function getEventDataEventsByEventName(
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

  const page = params.page || 1;
  const limit = params.limit || 100;
  // OFFSET = (页码-1) * 每页数量
  const offset = (page - 1) * limit;

  return rawQuery(
    `
    SELECT
 
      MAX(ED.created_at) as created_at,
      JSON_AGG(
          JSON_BUILD_OBJECT(
              'data_key', ED.data_key,
              'string_value', ED.string_value
          )
      ) as event_data,
      COUNT(*) OVER() as total
    FROM
      PUBLIC.EVENT_DATA ED
      INNER JOIN WEBSITE_EVENT WE ON ED.WEBSITE_EVENT_ID = WE.EVENT_ID AND WE.EVENT_NAME = {{event}}
    WHERE
      ED.WEBSITE_ID = {{websiteId::uuid}}
      AND ED.WEBSITE_EVENT_ID IN (
          SELECT WEBSITE_EVENT_ID
          FROM EVENT_DATA
          WHERE STRING_VALUE = {{stringValue}}
          AND data_key={{dataKey}}
      )
    GROUP BY
      ED.website_event_id
    ORDER BY
      created_at DESC
      ${'LIMIT ' + limit + ' OFFSET ' + offset}
    `,
    params,
  );
}

async function clickhouseQuery(
  websiteId: string,
  filters: QueryFilters,
): Promise<{ eventName: string; propertyName: string; dataType: number; total: number }[]> {
  const { rawQuery, parseFilters } = clickhouse;
  const { params } = await parseFilters(websiteId, filters);

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
