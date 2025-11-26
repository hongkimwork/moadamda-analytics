import json
import glob
from core.clarity import Clarity
from core.postgres import connection,transaction
from datetime import datetime,timedelta
from urllib.parse import urlparse, parse_qs, unquote_plus
from common import utils

async def run():
    clarity = Clarity() # 세션 목록 가져오기
    async with connection() as conn:
        res = await conn.fetchrow(
            "SELECT max(created_at) as last_check_date FROM clarity_user_list"
        )
        if res and res['last_check_date']:
            start_date = res['last_check_date']
        else:
            start_date = datetime(2024,6,1)

        already_user_dict = await conn.fetch(
            "SELECT idx, clarity_id FROM clarity_user_list WHERE created_at > now() - interval '7 day'"
        )
        already_user_dict = {
            row['clarity_id'] : row['idx']
            for row in already_user_dict
        }
        already_session_list = await conn.fetch(
            "SELECT clarity_id FROM clarity_session_list WHERE created_at > now() - interval '7 day'"
        )
        already_session_list = set([row['clarity_id'] for row in already_session_list])
        end_date = datetime.now()
        current_date = start_date - timedelta(days=0)
        while current_date <= end_date:
            session_list = await clarity.get_session_list(
                current_date,
                current_date + timedelta(days=1),
                start=0,
                limit=50000,
                sort='SessionStart ASC'
            )
            for row in session_list: # 클래리티 return 할 때 9시간 더해서 줌
                session_start_date = datetime.fromtimestamp(row['sessionStart']/1000)
                print(session_start_date)
                session_end_date = session_start_date + timedelta(seconds=row['sessionDuration'])
                user_id = str(row['userId'])
                if user_id not in already_user_dict:
                    user_idx = await conn.fetchrow(
                        """
                            INSERT INTO clarity_user_list
                            (clarity_id, created_at, updated_at)
                            VALUES
                            ($1,$2,$3)
                            ON CONFLICT(clarity_id)
                            DO UPDATE SET updated_at = $4
                            RETURNING idx;
                        """,str(user_id),session_start_date,session_start_date,session_start_date
                    )
                    already_user_dict[user_id] = user_idx['idx']
                else:
                    await conn.execute(
                        """
                            UPDATE clarity_user_list
                            SET updated_at = $1
                            WHERE idx = $2
                        """,session_start_date, already_user_dict[user_id]
                    )
                session_id = str(row['sessionId'])
                if session_id in already_session_list:
                    continue
                already_session_list.add(session_id)
                res = await conn.fetchrow(
                    """
                        INSERT INTO clarity_session_list
                        (user_idx, clarity_id, created_at, device_model, os_version, country, device, browser_name)
                        VALUES
                        ($1,$2,$3,$4,$5,$6,$7,$8)
                        ON CONFLICT(clarity_id)
                        DO UPDATE SET created_at = excluded.created_at
                        RETURNING idx;
                    """,already_user_dict[user_id],str(row['sessionId']),session_start_date,
                        row['deviceModel'],row['osVersion'],row['country'],row['device'],row['browserName']
                )
                session_idx = res['idx']
                await conn.execute(
                    """
                        INSERT INTO clarity_session_data (session_idx, data)
                        VALUES
                        ($1,$2)
                        ON CONFLICT(session_idx)
                        DO NOTHING;
                    """,session_idx,json.dumps(row,ensure_ascii=False)
                )
            current_date += timedelta(days=1)

    async with connection() as conn:
        utm_data = await conn.fetch(
            """SELECT idx, hash FROM ad_utm_info"""
        )
        utm_data = {
            row['hash'] : row['idx']
            for row in utm_data
        }
        session_list = await conn.fetch(
            """SELECT s.idx, d.data
            FROM clarity_session_list AS s
            LEFT JOIN clarity_session_data AS d
            ON s.idx = d.session_idx
            WHERE d.impressions is null"""
        )
        print(f'clarity add_runtime 파싱해야 할 세션 수 : {len(session_list)}')
        for row in session_list:
            row = dict(row)
            session_idx = row['idx']
            row['data'] = json.loads(row['data'])
            start_date = datetime.fromtimestamp(row['data']['sessionStart']/1000)
            end_date = start_date + timedelta(seconds=row['data']['sessionDuration']+1)
            page_list = await clarity.get_session_info(row['data']['userId'],row['data']['sessionId'],start_date, end_date)
            if not page_list:
                continue
            total_duration = 0
            total_active_duration = 0
            total_click_count = 0
            total_page_count = 0
            is_already_ad_checked=False
            for page in page_list:
                duration = page['duration']
                active_duration = page['duration']
                click_count = 0
                hidden_start = 0
                for event in page['timelineEvents']:
                    if event['eventtype'] == 'Page hidden':
                        hidden_start = event['start']
                    elif event['eventtype'] == 'Page visible':
                        active_duration -= event['start'] - hidden_start
                        hidden_start = 0
                    elif event['eventtype'] == 'Click':
                        click_count += 1
                if hidden_start:
                    active_duration -= duration - hidden_start
                total_click_count += click_count
                total_page_count += 1
                total_duration += duration
                total_active_duration += active_duration
                if 'utm_source' in page['url'] and not is_already_ad_checked:
                    utm_id = utm_source = utm_medium = utm_campaign = utm_content = utm_term = ''
                    is_already_ad_checked = True
                    parsed_url = urlparse(page['url'])
                    query_params = parse_qs(parsed_url.query)
                    if 'utm_source' in query_params:
                        utm_source = query_params['utm_source'][0]
                    if 'utm_medium' in query_params:
                        utm_medium = query_params['utm_medium'][0]
                    if 'utm_campaign' in query_params:
                        utm_campaign = query_params['utm_campaign'][0]
                    if 'utm_content' in query_params:
                        utm_content = query_params['utm_content'][0]
                        if utm_content.startswith('%'):
                            utm_content = unquote_plus(utm_content)
                        if utm_content.startswith('%'):
                            utm_content = unquote_plus(utm_content)
                    if 'utm_term' in query_params:
                        utm_term = query_params['utm_term'][0]
                    if 'utm_id' in query_params:
                        utm_id = query_params['utm_id'][0]
                        hashed = f'{utm_source}{utm_id}'
                    else:
                        hashed = utils.md5(f'{utm_source}{utm_medium}{utm_campaign}{utm_content}{utm_term}')
                    if hashed not in utm_data:
                        utm_data[hashed] = await utils.add_ad(
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
                            INSERT INTO clarity_ad_list
                            (session_idx, ad_utm_idx, duration, active_duration, click_count, created_at)
                            VALUES
                            ($1,$2,$3,$4,$5,$6)
                        """,session_idx,
                        utm_data[hashed],
                        duration,
                        active_duration,
                        click_count,
                        datetime.strptime(page['timestamp'],'%Y-%m-%d %H:%M:%S') + timedelta(hours=9)
                    )

            res = await conn.fetchrow(
                """
                    UPDATE clarity_session_list
                    SET
                        duration = $1,
                        active_duration = $2,
                        page_count = $3,
                        click_count = $4
                    WHERE idx = $5
                """,total_duration,total_active_duration,total_page_count,total_click_count,session_idx
            )
            await conn.execute(
                """
                    UPDATE clarity_session_data
                    SET impressions = $1
                    WHERE session_idx = $2
                """,json.dumps(page_list,ensure_ascii=False),session_idx
            )