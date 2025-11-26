import math
from copy import deepcopy
import json
import os
import glob
import time
from core.meta import Meta
from core.postgres import connection,transaction
from datetime import datetime,timedelta, date
from urllib.parse import urlparse, parse_qs


def get_data(data, ad_idx):
    res = {
        column : int(data.get(column,0))
        for column in ["spend","impressions","reach","cpc","cpm","ctr","roas","purchase_count","purchase_amount"]
    }
    for action in data.get('actions',[]):
        if action['action_type'] == 'offsite_conversion.fb_pixel_add_to_cart':
            res['add_to_cart_count'] = int(action['value'])
        elif action['action_type'] == 'offsite_conversion.fb_pixel_purchase':
            res['purchase_count'] = int(action['value'])
    res['clicks'] = sum([int(row['value']) for row in data.get('outbound_clicks',[])])
    if 'purchase_roas' in data:
        res['roas'] = float(data['purchase_roas'][0]['value'])
        if 'purchase_count' in res:
            res['purchase_amount'] = round(res['spend'] * res['roas'] / 100) * 100
    elif 'action_values' in data:
        for action in data.get('action_values',[]):
            if action['action_type'] == 'offsite_conversion.fb_pixel_purchase':
                res['purchase_amount'] = int(action['value'])
                try:
                    res['roas'] = res['purchase_amount'] / res['spend']
                except:
                    res['roas'] = 9999
    if res['clicks']:
        res['cpc'] = res['spend'] / res['clicks']
    if res['impressions']:
        res['cpm'] = res['spend'] / res['impressions'] * 1000
        res['ctr'] = res['clicks'] / res['impressions']*100
    for p in [25,50,75,100]:
        if f'video_p{p}_watched_actions' in data:
            res[f'video_p{p}_view_count'] = int(data[f'video_p{p}_watched_actions'][0]['value'])
    if 'video_avg_time_watched_actions' in data:
        res['video_average_second'] = int(data['video_avg_time_watched_actions'][0]['value'])
    if 'video_play_actions' in data:
        res['video_play_count'] = int(data['video_play_actions'][0]['value'])
    res['ad_idx'] = ad_idx
    res['log_date'] = datetime.strptime(data['date_start'],'%Y-%m-%d')
    if 'hourly_stats_aggregated_by_advertiser_time_zone' in data:
        res['log_hour'] = int(data['hourly_stats_aggregated_by_advertiser_time_zone'].split(':')[0])
    for column in Meta.BREAKDOWNS_LIST['HUMAN']+Meta.BREAKDOWNS_LIST['ENVIRONMENT']:
        if column in data:
            res[column] = data[column]
    res['updated_at'] = datetime.now()
    return res

TABLE_NAME_POSTFIX_DICT = {
    'NONE' : 'log',
    'HUMAN' : 'human_log',
    'ENVIRONMENT' : 'env_log'
}
TABLE_CON_KEY_DICT = {
    'NONE' : [],
    'HUMAN' : ['age','gender'],
    'ENVIRONMENT' : ['publisher_platform','platform_position','device_platform','impression_device']
}
async def run():
    meta = Meta()
    last_ad_id_list = []

    async with connection() as conn:
        res = await conn.fetch(
            """
                SELECT idx, ad_id FROM meta_ad_list
            """
        )
        db_ad_dict = {
            row['ad_id'] : row['idx']
            for row in res
        }
    for name, breakdowns in Meta.BREAKDOWNS_LIST.items():
        if name == 'HOUR':
            continue
        day_table_name = f'meta_ad_day_{TABLE_NAME_POSTFIX_DICT[name]}'
        hour_table_name = f'meta_ad_hour_{TABLE_NAME_POSTFIX_DICT[name]}'
        day_con_key = 'ad_idx,log_date'
        hour_con_key = 'ad_idx,log_date,log_hour'
        if TABLE_CON_KEY_DICT[name]:
            day_con_key += ','+','.join(TABLE_CON_KEY_DICT[name])
            hour_con_key += ','+','.join(TABLE_CON_KEY_DICT[name])
        async with connection() as conn:
            last_row = await conn.fetchrow(
                f"""
                    SELECT * FROM {day_table_name} ORDER BY updated_at DESC LIMIT 1
                """
            )
            if last_row and last_row['updated_at']:
                start_date = datetime.combine(last_row['updated_at'],datetime.min.time())
            else:
                start_date = datetime(2024,6,1)
            # start_date = datetime.fromtimestamp(parse_time).replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            current_date = start_date
            while current_date <= end_date:
                current_date_str = current_date.strftime("%Y-%m-%d")
                today_log = await conn.fetch(
                    f"""
                        SELECT * FROM {day_table_name}
                        WHERE log_date = $1
                    """,current_date.date()
                )
                today_log = {
                    ','.join([str(row[column]) for column in TABLE_CON_KEY_DICT[name]+['ad_idx']]) : row
                    for row in today_log
                }
                if name == 'NONE':
                    ad_list = await meta.get_insight(
                        current_date_str,
                        current_date_str,
                        breakdowns=breakdowns,
                        limit=50000
                    )
                    last_ad_id_list = [ad['ad_id'] for ad in ad_list]
                else:
                    ad_list = await meta.get_insight(
                        current_date_str,
                        current_date_str,
                        breakdowns=breakdowns,
                        limit=50000
                    )
                await conn.execute(
                    """
                        INSERT INTO meta_raw_data
                        (name,parse_date,data,target_date)
                        VALUES
                        ($1,$2,$3,$4)
                    """,name,datetime.now(),json.dumps(ad_list,ensure_ascii=False),current_date
                )
                current_date_for_db = datetime.now()
                async with transaction(conn) as trans:
                    for ad in ad_list:
                        if ad['ad_id'] not in db_ad_dict:
                            res = await conn.fetchrow(
                                """
                                    INSERT INTO meta_ad_list (ad_id) VALUES ($1) RETURNING idx;
                                """,ad['ad_id']
                            )
                            db_ad_dict[ad['ad_id']] = res['idx']
                        data = get_data(ad,db_ad_dict[ad['ad_id']])
                        table_key = ','.join([data[column] for column in TABLE_CON_KEY_DICT[name]]+[str(db_ad_dict[ad['ad_id']])])

                        await trans.execute(
                            f"""
                                INSERT INTO {day_table_name}
                                ({','.join(data.keys())}) VALUES({','.join([f'${i+1}' for i in range(len(data.keys()))])})
                                ON CONFLICT({day_con_key})
                                DO UPDATE SET
                                {','.join([key+'=$'+str(len(data.keys())+i+1) for i,key in enumerate(data.keys())])}
                            """,*data.values(), *data.values()
                        )
                        if table_key in today_log:  # 이전 시간이랑 시간 분할해서 넣기
                            start_time = (int(today_log[table_key]['updated_at'].timestamp()) + 9*3600) % 86400
                            for key, value in data.items():
                                if type(value) in [int] and key not in ['idx','ad_idx','log_hour','video_average_second']:
                                    data[key] -= today_log[table_key][key]
                            copy_data = await trans.fetchrow(
                                f"""
                                    SELECT * FROM {hour_table_name}
                                    WHERE {' AND '.join([key+'=$'+str(1+i) for i,key in enumerate(['ad_idx','log_date','log_hour']+TABLE_CON_KEY_DICT[name])])}
                                """,db_ad_dict[ad['ad_id']], date.fromisoformat(current_date_str),math.floor(start_time/3600),*[data[key] for key in TABLE_CON_KEY_DICT[name]]
                            )
                            if copy_data:
                                copy_data = dict(copy_data)
                                copy_data.pop('idx')
                            else:
                                copy_data = deepcopy(data)
                                for key, value in copy_data.items():
                                    if type(value) in [int] and key not in ['idx','ad_idx','log_hour','video_average_second']:
                                        copy_data[key] = 0
                        else:   # 오늘 기록 아무것도 없었으니 0시부터 분할해서 넣기
                            if today_log:
                                start_time = (int(list(today_log.values())[0]['updated_at'].timestamp()) + 9*3600) % 86400
                                copy_data = deepcopy(data)
                                for key, value in copy_data.items():
                                    if type(value) in [int] and key not in ['idx','ad_idx','log_hour','video_average_second']:
                                        copy_data[key] = 0
                            else:
                                start_time = 0
                                copy_data = deepcopy(data)
                        to_seconds = (current_date_for_db - current_date).total_seconds()
                        if to_seconds > 86400:
                            to_seconds = 86400
                        unit_price = 0
                        if data.get('purchase_count',0):
                            unit_price = data['purchase_amount'] / data['purchase_count']
                        while start_time < to_seconds:
                            percent = (3600 - start_time % 3600) / (to_seconds - start_time)
                            if percent > 1 or start_time + 3600 > to_seconds:
                                percent = 1
                            for key, value in data.items():
                                if type(value) in [int] and key not in ['idx','ad_idx','log_hour','video_average_second']:
                                    if start_time % 3600 != 0:
                                        copy_data[key] += round(percent * value)
                                    else:
                                        copy_data[key] = round(percent * value)
                                    data[key] -= round(percent * value)
                            if 'video_average_second' in data:
                                copy_data['video_average_second'] = data['video_average_second']
                            if copy_data['clicks']:
                                copy_data['cpc'] = copy_data['spend'] / copy_data['clicks']
                            else:
                                copy_data['cpc'] = 0
                            if copy_data['impressions']:
                                copy_data['cpm'] = copy_data['spend'] / copy_data['impressions'] * 1000
                                copy_data['ctr'] = copy_data['clicks'] / copy_data['impressions']*100
                            else:
                                copy_data['cpm'] = 0
                                copy_data['ctr'] = 0
                            copy_data['purchase_amount'] = copy_data.get('purchase_count',0) * unit_price

                            copy_data['log_hour'] = math.floor(start_time / 3600)
                            await trans.execute(
                                f"""
                                    INSERT INTO {hour_table_name}
                                    ({','.join(copy_data.keys())}) VALUES({','.join([f'${i+1}' for i in range(len(copy_data.keys()))])})
                                    ON CONFLICT({hour_con_key})
                                    DO UPDATE SET
                                    {','.join([key+'=$'+str(len(copy_data.keys())+i+1) for i,key in enumerate(copy_data.keys())])}
                                """,*copy_data.values(), *copy_data.values()
                            )
                            start_time += 3600 - start_time % 3600
                            print(f'메타 실시간 데이터 {name} {ad_list.index(ad)+1}/{len(ad_list)} 완료\n현재시간 - {datetime.now()}, 완료시간 - {current_date} {copy_data['log_hour']}:00:00')
                current_date += timedelta(days=1)
                ad_list = []