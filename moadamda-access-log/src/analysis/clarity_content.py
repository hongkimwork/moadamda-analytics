from core.clarity import Clarity
from datetime import datetime,timedelta
import urllib.parse

async def run():
    clarity = Clarity()
    start_date = datetime(2024,7,27)
    end_date = datetime(2024,8,3)
    gone_dict = {}
    for (start,end,key) in [(0,3,'none_gone'),(4,5,'price_gone'),(6,16,'review_gone')]:
        filters = [
            clarity.get_field_range('scrollReachVerticalDocumentRelative',start,end),
            {
                "field": "Url",
                "dataType": "String",
                "operator": "Contains",
                "value": "utm_content=",
                "invert": False
            }
        ]
        session_list = await clarity.get_session_list(start_date,end_date,filters,limit=5000)
        for row in session_list:
            gone_dict[row['id']] = key
    filters = [
        {
            "field": "Url",
            "dataType": "String",
            "operator": "Contains",
            "value": "utm_content=",
            "invert": False
        }
    ]
    session_list = await clarity.get_session_list(start_date,end_date,filters,limit=5000)
    columns = {
        'utm_source' : 'utm_source',
        'utm_medium' : 'utm_medium',
        'utm_campaign' : 'utm_campaign',
        'utm_content' : 'utm_content',
        'under_5' : '5초내 이탈율',
        'under_10' : '10초내 이탈율',
        'under_15' : '15초내 이탈율',
        'under_30' : '30초내 이탈율',
        'average_page_count' : '세션당 페이지 수',
        'none_gone' : '아무것도 안한 이탈율',
        'price_gone' : '가격보고 이탈율',
        'review_gone' : '리뷰보고 이탈율',
        'total' : '전체 유입수'
    }
    result = {}
    for session in session_list:
        page_count = session['pageCount']
        entry_url = session['entryUrl']
        session_duration = session['sessionDuration']
        query = urllib.parse.unquote_plus(entry_url.split('?')[-1])
        if '{{' in query:
            continue
        query_params = urllib.parse.parse_qs(query)
        utm_source = utm_medium = utm_campaign = utm_content = ''
        if 'utm_source' in query_params:
            utm_source = query_params['utm_source'][0]
        if 'utm_medium' in query_params:
            utm_medium = query_params['utm_medium'][0]
        if 'utm_campaign' in query_params:
            utm_campaign = query_params['utm_campaign'][0]
        if 'utm_content' in query_params:
            utm_content = query_params['utm_content'][0]

        key = f'{utm_source}{utm_medium}{utm_campaign}{utm_content}'
        if key not in result:
            result[key] = {
                column : 0
                for column in columns.keys()
            }
            result[key].update({
                'utm_source' : utm_source,
                'utm_medium' : utm_medium,
                'utm_campaign' : utm_campaign,
                'utm_content' : utm_content
            })
        result[key]['total'] += 1
        result[key]['average_page_count'] += page_count
        if page_count == 1:
            if session_duration <= 5:
                result[key]['under_5'] += 1
            if session_duration <= 10:
                result[key]['under_10'] += 1
            if session_duration <= 15:
                result[key]['under_15'] += 1
            if session_duration <= 30:
                result[key]['under_30'] += 1
        else:
            pass
        if session['id'] in gone_dict:
            result[key][gone_dict[session['id']]] += 1

    headers = '\t'.join(list(columns.values()))
    csv = [headers]
    for key, data in result.items():
        data['under_5'] = str(round(data['under_5']/data['total'],2))
        data['under_10'] = str(round(data['under_10']/data['total'],2))
        data['under_15'] = str(round(data['under_15']/data['total'],2))
        data['under_30'] = str(round(data['under_30']/data['total'],2))
        data['none_gone'] = str(round(data['none_gone']/data['total'],2))
        data['price_gone'] = str(round(data['price_gone']/data['total'],2))
        data['review_gone'] = str(round(data['review_gone']/data['total'],2))
        data['average_page_count'] = str(round(data['average_page_count']/data['total'],2))
        data['total'] = str(data['total'])
        csv.append('\t'.join(list(data.values())))
    with open(f'./output/data.csv','wt') as f:
        f.write('\n'.join(csv))