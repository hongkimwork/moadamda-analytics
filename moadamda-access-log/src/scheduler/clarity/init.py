import json
import glob
from core.clarity import Clarity
from core.postgres import connection,transaction
from datetime import datetime,timedelta
from urllib.parse import urlparse, parse_qs, unquote_plus
from common import utils

async def run():
    clarity = Clarity() # 세션 목록 가져오기
    start_date = datetime(2024,6,1)
    for filename in glob.glob('./output/clarity/list/*.json'):
        log_date = filename.split('/')[-1].split('.')[0]
        log_date = datetime.strptime(log_date,'%Y-%m-%d')
        if start_date <= log_date:
            start_date = log_date + timedelta(days=1)
    end_date = datetime.now()
    current_date = start_date + timedelta(days=0)
    while current_date <= end_date:
        result = []
        while True:
            session_list = await clarity.get_session_list(
                current_date,
                current_date + timedelta(days=1),
                start=len(result),
                limit=50000,
                sort='SessionStart ASC'
            )
            result.extend(session_list)
            if len(session_list) < 50000:
                break
            else:
                print(f'{len(session_list)}')
        with open(f'./output/clarity/list/{current_date.strftime("%Y-%m-%d")}.json','wt') as f:
            f.write(json.dumps(result,ensure_ascii=False))
        current_date += timedelta(days=1)

    already_processed_set = set()
    clarity = Clarity()
    for filename in glob.glob('./output/clarity/session/*.json'):
        session_id = filename.split('/')[-1].split('.')[0]
        already_processed_set.add(str(session_id))
    for filename in glob.glob('./output/clarity/list/*.json'):
        with open(filename,'rt') as f:
            session_list = json.loads(f.read())
            for row in session_list:
                if str(row['sessionId']) in already_processed_set:
                    continue
                start_date = datetime.fromtimestamp(row['sessionStart']/1000)
                end_date = datetime.fromtimestamp((row['sessionStart']/1000+row['sessionDuration']+1))
                res = await clarity.get_session_info(row['userId'],row['sessionId'],start_date, end_date)
                with open(f'./output/clarity/session/{row["sessionId"]}.json','wt') as f:
                    f.write(json.dumps(res,ensure_ascii=False))
                already_processed_set.add(str(row['sessionId']))
                print(f'{len(already_processed_set)} 완료')



    user_dict = {}
    for filename in glob.glob('./output/clarity/list/*.json'):
        with open(filename,'rt') as f:
            session_list = json.loads(f.read())
            for row in session_list:
                if row['userId'] not in user_dict:
                    user_dict[row['userId']] = {
                        'created_at' : datetime.fromtimestamp(row['sessionStart']/1000)
                    }
                user_dict[row['userId']]['updated_at'] = datetime.fromtimestamp(row['sessionStart']/1000)

    async with connection() as conn:
        async with transaction(conn) as sess:
            for clarity_id,data in user_dict.items():
                await sess.execute(
                    """
                        INSERT INTO clarity_user_list
                        (clarity_id, created_at, updated_at)
                        VALUES
                        ($1,$2,$3)
                        ON CONFLICT (clarity_id)
                        DO UPDATE
                        SET updated_at = $4
                    """,str(clarity_id),data['created_at'],data['updated_at'],data['updated_at']
                )

    async with connection() as conn:
        res = await conn.fetch(
            """SELECT idx, clarity_id FROM clarity_user_list"""
        )
        user_dict = {
            row['clarity_id'] : row['idx']
            for row in res
        }

    already_session_set = set()
    async with connection() as conn:
        async with transaction(conn) as sess:
            for filename in glob.glob('./output/clarity/list/*.json'):
                with open(filename,'rt') as f:
                    session_list = json.loads(f.read())
                    for row in session_list:
                        if row['sessionId'] in already_session_set:
                            continue
                        already_session_set.add(row['sessionId'])

                        utm_source = utm_medium = utm_campaign = utm_content = utm_term = ''
                        try:
                            with open(f'./output/clarity/session/{row['sessionId']}.json','rt') as f:
                                page_list = json.loads(f.read())
                        except:
                            print(filename)
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

                        res = await sess.fetchrow(
                            """
                                INSERT INTO clarity_session_list
                                (user_idx, clarity_id, created_at, duration, active_duration, page_count, click_count, device_model, os_version, country, device, browser_name)
                                VALUES
                                ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                                RETURNING idx;
                            """,user_dict[str(row['userId'])],str(row['sessionId']),datetime.fromtimestamp(row['sessionStart']/1000),
                                total_duration,total_active_duration,total_page_count,total_click_count,row['deviceModel'],row['osVersion'],row['country'],row['device'],row['browserName']
                        )
                        session_idx = res['idx']
                        await sess.execute(
                            """
                                INSERT INTO clarity_session_data (session_idx, data, impressions)
                                VALUES
                                ($1,$2)
                            """,session_idx,json.dumps(row,ensure_ascii=False), json.dumps(page_list,ensure_ascii=False)
                        )
        utm_data = await conn.fetch(
            """SELECT idx, hash FROM ad_utm_info"""
        )
        utm_data = {
            row['hash'] : row['idx']
            for row in utm_data
        }
        session_list = await conn.fetch(
            """SELECT idx, clarity_id FROM clarity_session_list"""
        )
        for session_row in session_list:
            with open(f'./output/clarity/session/{session_row['clarity_id']}.json','rt') as f:
                page_list = json.loads(f.read())
            session_idx = session_row['idx']
            is_already_ad_checked = False
            for page in page_list:
                if 'utm_source' in page['url'] and not is_already_ad_checked:
                    utm_id=utm_source=utm_medium=utm_campaign=utm_content=utm_term=''
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
                        hashed = utils.md5(f'{utm_source}{utm_id}')
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