from core.meta import Meta
from core.postgres import connection,transaction
from datetime import datetime,timedelta
from urllib.parse import urlparse, parse_qs

async def run():
    meta = Meta()
    start_date = '2024-06-01'
    end_date = datetime.now().strftime('%Y-%m-%d')
    page_list = await meta.get_page_list()
    async with connection() as conn:
        for page in page_list:
            await conn.execute(
                """
                    INSERT INTO meta_page_list
                    (page_name, page_id, access_token)
                    VALUES
                    ($1,$2,$3)
                    ON CONFLICT(page_id)
                    DO UPDATE SET
                    access_token = $4
                """,page['page_name'],page['page_id'],page['access_token'],page['access_token']
            )
    ad_list = await meta.get_insight(
        start_date,
        end_date,
        breakdowns=Meta.BREAKDOWNS_LIST['NONE'],
        fields=Meta.InsightField.OVERVIEW
    )
    async with connection() as conn:
        async with transaction(conn) as session:
            for ad in ad_list:
                await session.execute(
                    """
                        INSERT INTO meta_ad_list
                        (campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, created_time, optimization_goal, updated_time)
                        VALUES
                        ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                    """,ad['campaign_id'],
                    ad['campaign_name'],
                    ad['adset_id'],
                    ad['adset_name'],
                    ad['ad_id'],
                    ad['ad_name'],
                    datetime.strptime(ad['created_time'],'%Y-%m-%d'),
                    ad['optimization_goal'],
                    datetime.strptime(ad['updated_time'],'%Y-%m-%d')
                )

    async with connection() as conn:
        res = await conn.fetch(
            """SELECT ad_id FROM meta_ad_list WHERE creative_id is null"""
        )
        ad_id_list = [int(row['ad_id']) for row in res]
        if ad_id_list:
            creative_list = await meta.get_creative_id(
                start_date,end_date,ad_id_list=ad_id_list
            )
            async with transaction(conn) as session:
                for creative in creative_list:
                    await session.execute(
                        """
                            UPDATE meta_ad_list
                            SET creative_id = $1
                            WHERE ad_id = $2
                        """,creative['creative']['id'],creative['id']
                    )

    async with connection() as conn:
        res = await conn.fetch(
            """
                SELECT page_id, access_token
                FROM meta_page_list
            """
        )
        page_dict = {row['page_id'] : row['access_token'] for row in res}
    async with connection() as conn:
        ads = await conn.fetch(
            """SELECT idx, ad_name, creative_id from meta_ad_list where creative_id is not null and utm_source is null"""
        )
        for ad in ads:
            landing_url = await meta.get_ad_landing_url(ad['creative_id'],ad['ad_name'],page_dict)
            if not landing_url:
                continue
            parsed_url = urlparse(landing_url)
            query_params = parse_qs(parsed_url.query)
            utm_id = utm_source = utm_medium = utm_campaign = utm_content = utm_term = ''
            if 'utm_source' in query_params:
                utm_source = query_params['utm_source'][0]
            if 'utm_medium' in query_params:
                utm_medium = query_params['utm_medium'][0]
            if 'utm_campaign' in query_params:
                utm_campaign = query_params['utm_campaign'][0]
            if 'utm_content' in query_params:
                utm_content = query_params['utm_content'][0]
            if 'utm_term' in query_params:
                utm_term = query_params['utm_term'][0]
            if 'utm_id' in query_params:
                utm_id = query_params['utm_id'][0]
            await conn.execute(
                """
                    UPDATE meta_ad_list
                    SET utm_source = $1, utm_medium = $2, utm_campaign = $3, utm_content = $4, utm_term = $5, utm_id = $6
                    WHERE idx = $7
                """,utm_source,utm_medium,utm_campaign,utm_content,utm_term,utm_id,ad['idx']
            )
        await conn.execute(
            """
                INSERT INTO ad_utm_info
                (utm_source, utm_content, utm_medium, utm_campaign, utm_term,utm_id, hash)
                (SELECT
                    utm_source, ad_name as utm_content, utm_medium, utm_campaign, utm_term, utm_id,
                    CASE WHEN utm_id > ''
                    THEN md5(utm_source || utm_id)
                    ELSE md5(utm_source || utm_medium || utm_campaign || ad_name || utm_term)
                    END as hash
                from meta_ad_list where status != 'ARCHIVED')
                ON CONFLICT(hash)
                DO NOTHING;
            """
        )

        utm_data = await conn.fetch(
            """
                SELECT idx, hash FROM ad_utm_info
            """
        )
        utm_data = {
            row['hash'] : row['idx']
            for row in utm_data
        }
        meta_ad_data = await conn.fetch(
            """
                SELECT md5(utm_source || utm_medium || utm_campaign || ad_name || utm_term) as hash, max(idx) as idx
                FROM meta_ad_list where status != 'ARCHIVED'
                AND utm_id = ''
                GROUP BY md5(utm_source || utm_medium || utm_campaign || ad_name || utm_term)
                UNION
                SELECT md5(utm_source || utm_id) as hash, max(idx) as idx
                FROM meta_ad_list where status != 'ARCHIVED'
                AND utm_id > ''
                GROUP BY md5(utm_source || utm_id)
            """
        )
        for row in meta_ad_data:
            if row['hash'] not in utm_data:
                continue
            await conn.execute(
                """
                    INSERT INTO ad_utm_meta_relation
                    (utm_idx, meta_ad_idx)
                    VALUES ($1,$2)
                    ON CONFLICT(utm_idx, meta_ad_idx)
                    DO NOTHING;
                """,utm_data[row['hash']],row['idx']
            )