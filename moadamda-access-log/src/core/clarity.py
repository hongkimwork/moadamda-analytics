from datetime import datetime,timedelta
import json
import urllib.parse
import time
import aiohttp
import asyncio
from conf.settings import settings
from core.postgres import connection

class Clarity:
    async def get_header(self):
        return {
            'accept': '*/*',
            'accept-language': 'en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7',
            'content-type': 'application/json',
            'origin' : 'https://clarity.microsoft.com',
            'user-agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'csrf-token' : settings.CLARITY_CSRF,
            'cookie' : settings.CLARITY_COOKIE,
            'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
        }
    async def call(self,url,method='get',**kwargs):
        headers = kwargs.pop('headers',{})
        headers.update(await self.get_header())
        for i in range(10):
            try:
                async with aiohttp.ClientSession() as session:
                    if method == 'get':
                        _method = session.get
                    elif method == 'put':
                        _method = session.put
                    elif method == 'post':
                        _method = session.post
                    async with _method(
                        url,
                        headers=headers,
                        **kwargs
                    ) as resp:
                        if resp.status != 200:
                            print(resp.headers)
                            print(await resp.text())
                            print(resp.status)
                            if resp.status == 429:
                                await asyncio.sleep(300)
                            else:
                                await asyncio.sleep((i+1)*5)
                            continue
                        return await resp.json()
            except Exception as e:
                print(e)

    async def get_session_list(self,start_date, end_date, filters=[], start=0, limit=5000, sort=None):
        start_date = start_date - timedelta(hours=9) # yyyy mm dd 로 바꾸기 위해 9시간 뺌
        end_date = end_date - timedelta(hours=9,seconds=1)
        referer = f'https://clarity.microsoft.com/projects/view/{settings.CLARITY_ID}/impressions'
        # start_time = int(datetime.strptime(start_date,'%Y-%m-%d').timestamp())*1000
        # end_time = int(datetime.strptime(end_date,'%Y-%m-%d').timestamp())*1000
        # querys = [f'URL=2;2;{url_contain},2;2;','date=Custom','heatmapDeviceType=0&heatmapType=1',f'start={start_time}',f'end={end_time}']
        # for key,value in kwargs:
        #     querys.append(f'{key}={value}')
        # referer += urllib.parse.urlencode(querys)
        filter_query = {
            "operator": "And",
            "filters": [
                {
                    "field": "minEnqueuedTimestamp",
                    "dataType": "Number",
                    "operator": "Range",
                    "value": {
                        "min": f"{start_date.isoformat().split('.')[0]}.000Z",
                        "max": f"{end_date.isoformat().split('.')[0]}.999Z",
                    }
                }
            ]
        }
        if filters:
            filter_query['filters'].append(
                {
                    "operator": "And",
                    "filters": filters
                }
            )
        res = await self.call(
            f'https://clarity.microsoft.com/api/v2',
            'post',
            headers={
                'referer' : referer
            },
            json={
                'operationName' : 'getSessions',
                'variables' : {
                    'projectId' : settings.CLARITY_ID,
                    'filter' : json.dumps(filter_query,ensure_ascii=False),
                    'sort' : sort,
                    'limit': limit,
                    'skip' : start,
                    'withFavorites': True,
                    'withTags' : True,
                    "isAppProject": False,
                    "withLikeStatus": True,
                    "withSimilarity": False,
                    "isVisitorProfile": True,
                },
                "query": "query getSessions($projectId: String!, $limit: Int, $filter: String, $sort: String, $skip: Int, $userIds: [Float], $sessionIds: [Float], $withFavorites: Boolean, $withTags: Boolean, $isAppProject: Boolean, $isVisitorProfile: Boolean, $withLikeStatus: Boolean) { projectFeatures(id: $projectId) { id sessions(serializedFilter: $filter, sortClause: $sort, skip: $skip, limit: $limit, userIds: $userIds, sessionIds: $sessionIds, withFavorites: $withFavorites, withTags: $withTags, isAppProject: $isAppProject, isVisitorProfile: $isVisitorProfile, withLikeStatus: $withLikeStatus) { id projectId userId sessionId sessionStart sessionDuration entryUrl exitUrl referrer browserName device os pageCount sessionClickCount country state city isFavorite tags entryScreen exitScreen osVersion deviceModel customUserId customUserHints customSessionId customUserIds customSessionIds viewPortWidth viewPortHeight likeStatus __typename } __typename } }"
            }
        )
        return res['data']['projectFeatures']['sessions']

    async def get_session_info(self,user_id, session_id, start_date, end_date):
        start_date = (start_date - timedelta(hours=9)).strftime('%Y-%m-%d %H:%M:%S')
        end_date = (end_date - timedelta(hours=9)).strftime('%Y-%m-%d %H:%M:%S')
        referer = f'https://clarity.microsoft.com/projects/view/{settings.CLARITY_ID}/impressions'
        res = await self.call(
            f'https://clarity.microsoft.com/api/v2',
            'post',
            headers={
                'referer' : referer
            },
            json={
                'operationName' : 'getSessionInfo',
                'variables' : {
                    'projectId' : settings.CLARITY_ID,
                    'sessionId' : session_id,
                    'userId' : user_id,
                    'start' : start_date,
                    'end' : end_date
                },
                "query": "query getSessionInfo($projectId: String!, $sessionId: Float!, $userId: Float!, $start: String, $end: String) { sessionInfo(projectId: $projectId, sessionId: $sessionId, userId: $userId, start: $start, end: $end) { projectId sessionId impressions { id time duration displayTitle key pageNum timestamp pageLoadTime url userId referrerUrl timelineEvents { start eventtype subtype text __typename } device documentWidth documentHeight variables customPageId lcp fid cls score __typename } __typename } } "
            }
        )
        try:
            return res['data']['sessionInfo']['impressions']
        except Exception as e:
            print(e)
            return []
    def get_field_range(self, field_name,start,end):
        return {
            "operator": "And",
            "filters": [
                {
                    "field": field_name,
                    "dataType": "Number",
                    "operator": "GreaterOrEqual",
                    "value": start
                },
                {
                    "field": field_name,
                    "dataType": "Number",
                    "operator": "LessOrEqual",
                    "value": end
                }
            ]
        }