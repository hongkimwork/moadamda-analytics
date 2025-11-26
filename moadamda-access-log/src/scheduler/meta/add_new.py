from core.meta import Meta
from core.postgres import connection,transaction
from datetime import datetime,timedelta
from urllib.parse import urlparse, parse_qs
from common import utils

async def run():
    meta = Meta()
    start_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    end_date = datetime.now().strftime('%Y-%m-%d')
    async with connection() as conn:
        ad_list = await conn.fetch(
            """SELECT idx, ad_id FROM meta_ad_list where campaign_id is null"""
        )
        if not ad_list:
            return
        else:
            ad_id_dict = {
                row['ad_id'] : row['idx']
                for row in ad_list
            }
    print(f'새로 추가 된 광고 수 : {len(ad_list)}')
    new_ad_id_list = list(ad_id_dict.keys())
    ad_list = await meta.get_insight(
        start_date,
        end_date,
        breakdowns=Meta.BREAKDOWNS_LIST['NONE'],
        ad_id_list=new_ad_id_list,
        fields=Meta.InsightField.OVERVIEW
    )
    async with connection() as conn:
        async with transaction(conn) as session:
            for ad in ad_list:
                await session.execute(
                    """
                        UPDATE meta_ad_list
                        SET
                            campaign_id=$1,
                            campaign_name=$2,
                            adset_id=$3,
                            adset_name=$4,
                            ad_name=$5,
                            created_time=$6,
                            optimization_goal=$7,
                            updated_time=$8
                        WHERE ad_id=$9
                    """,ad['campaign_id'],
                    ad['campaign_name'],
                    ad['adset_id'],
                    ad['adset_name'],
                    ad['ad_name'],
                    datetime.strptime(ad['created_time'],'%Y-%m-%d'),
                    ad['optimization_goal'],
                    datetime.strptime(ad['updated_time'],'%Y-%m-%d'),
                    ad['ad_id'],
                )

    creative_list = await meta.get_creative_id(
        start_date,end_date,ad_id_list=new_ad_id_list
    )
    async with connection() as conn:
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
            """
                SELECT
                    idx, ad_id, ad_name, creative_id
                from meta_ad_list
                where creative_id is not null and utm_source is null
                AND ad_id = ANY($1)""",new_ad_id_list
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
                utm_id = ad['ad_id']
            await conn.execute(
                """
                    UPDATE meta_ad_list
                    SET utm_source = $1, utm_medium = $2, utm_campaign = $3, utm_content = $4, utm_term = $5, utm_id = $6
                    WHERE idx = $7
                """,utm_source,utm_medium,utm_campaign,utm_content,utm_term,utm_id,ad['idx']
            )
            utm_idx = await utils.add_ad(
                conn,
                utm_source,
                utm_medium,
                utm_campaign,
                utm_content,
                utm_term,
                utm_id
            )
            await conn.execute(
                """
                    INSERT INTO ad_utm_meta_relation
                    (utm_idx, meta_ad_idx)
                    VALUES ($1,$2)
                    ON CONFLICT(utm_idx, meta_ad_idx)
                    DO NOTHING;
                """,utm_idx,ad['idx']
            )