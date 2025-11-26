import datetime
import aiohttp
import asyncio
from conf.settings import settings
from core.postgres import connection
import json

class Meta:
    class InsightField:
        OVERVIEW = ['ad_id','ad_name','adset_id','adset_name','campaign_id','campaign_name','optimization_goal','created_time','updated_time']
        LOG = ['ad_id', 'spend', 'impressions', 'outbound_clicks', 'purchase_roas', 'reach', 'actions', 'created_time', 'updated_time', 'video_avg_time_watched_actions', 'video_p100_watched_actions', 'video_p25_watched_actions', 'video_p50_watched_actions', 'video_p75_watched_actions', 'video_time_watched_actions','video_play_actions']

    BREAKDOWNS_LIST = {
        'HUMAN' : ['age','gender'],
        'ENVIRONMENT' : ['publisher_platform', 'platform_position', 'device_platform', 'impression_device'],
        'HOUR' : ['hourly_stats_aggregated_by_advertiser_time_zone'],
        'NONE' : [],
    }

    def __init__(self):
        self.base_url = f'https://graph.facebook.com/v20.0/'
    async def call(self,url,method='get',**kwargs):
        if not url.startswith('https://'):
            url = self.base_url+url
        if 'params' not in kwargs:
            kwargs['params'] = {}
        if 'access_token' not in kwargs['params']:
            kwargs['params']['access_token'] = f'{settings.META_ACCESS_TOKEN}'
        for _ in range(3):
            async with aiohttp.ClientSession() as session:
                if method == 'get':
                    _method = session.get
                elif method == 'put':
                    _method = session.put
                elif method == 'post':
                    _method = session.post
                async with _method(
                    url,
                    **kwargs
                ) as resp:
                    headers = resp.headers
                    if resp.status != 200:
                        print(headers)
                        print(await resp.text())
                        await asyncio.sleep(3)
                        continue
                    res = await resp.json()
            use_case_usage = headers.get('x-business-use-case-usage','')
            if use_case_usage:
                use_case_usage = json.loads(use_case_usage)
                use_case_usage = list(use_case_usage.values())[0][0]
                if (
                    use_case_usage['call_count'] > 90
                    or use_case_usage['total_cputime'] > 90
                    or use_case_usage['total_time'] > 90
                ):
                    print(use_case_usage)
                    await asyncio.sleep(600)
            insights_trottle = headers.get('x-fb-ads-insights-throttle','')
            if insights_trottle:
                insights_trottle = json.loads(insights_trottle)
                if (
                    insights_trottle['app_id_util_pct'] > 0.9
                    or insights_trottle['acc_id_util_pct'] > 90
                ):
                    print(insights_trottle)
                    await asyncio.sleep(600)
            return res

    async def get_insight(self,start_date,end_date,breakdowns=BREAKDOWNS_LIST['HOUR'],is_active_only=True,ad_id_list=[],level='ad',fields=[],limit=5000):
        real_response = []

        if not fields:
            fields = Meta.InsightField.LOG
        params = {
            'fields' : ','.join(fields),
            'time_range' : {
                'since' : start_date,
                'until' : end_date
            },
            'limit' : limit,
            'use_account_attribution_setting' : 'true',
            'use_unified_attribution_setting' : 'true',
            'level' : level,
            'filtering' : []
        }

        if ad_id_list:
            params['filtering'].append(
                {
                    'field' : 'ad.id',
                    'operator' : 'IN',
                    'value' : ad_id_list[:100]
                }
            )
        if is_active_only:
            params['filtering'].append(
                {
                    'field' : 'spend',
                    'operator' : 'GREATER_THAN',
                    'value' : '0'
                }
            )
        params['breakdowns'] = breakdowns
        for key in params.keys():
            if type(params[key]) in (list,dict):
                params[key] = json.dumps(params[key])
        res = await self.call(
            f'{settings.META_AD_ACCOUNT_ID}/insights',
            params=params
        )
        real_response.extend(res['data'])
        if len(ad_id_list) > 100:
            real_response.extend(await self.get_insight(start_date,end_date,breakdowns,is_active_only,ad_id_list[100:],level,fields,limit))
        return real_response
    async def get_creative_id(self, start_date, end_date,ad_id_list=[]):
        params = {
            'fields' : ','.join(['id','creative']),
            'time_range' : {
                'since' : start_date,
                'until' : end_date
            },
            'filtering' : [],
            'limit' : 5000
        }
        if ad_id_list:
            params['filtering'].append(
                {
                    'field' : 'ad.id',
                    'operator' : 'IN',
                    'value' : ad_id_list
                }
            )
        for key in params.keys():
            if type(params[key]) in (list,dict):
                params[key] = json.dumps(params[key])
        res = await self.call(
            f'{settings.META_AD_ACCOUNT_ID}/ads',
            params=params
        )
        return res['data']

    async def get_ad_landing_url(self, creative_id,ad_name,page_dict):
        res = await self.call(
            f'{creative_id}/',
            params={
                'fields' : ','.join(['call_to_action_type','template_url','object_store_url','effective_object_story_id','effective_instagram_story_id','object_story_spec','link_url','object_url','url_tags','asset_feed_spec','creative_sourcing_spec','interactive_components_spec','omnichannel_link_spec','template_url_spec'])
            }
        )
        try:
            if 'url_tags' in res and res['url_tags']:
                return f'https://a.com?{res['url_tags']}'
            return res['object_story_spec']['video_data']['call_to_action']['value']['link']
        except:
            try:
                return res['object_story_spec']['link_data']['link']
            except:
                try:
                    return res['asset_feed_spec']['link_urls'][0]['website_url']
                except:
                    try:
                        post_id = res['effective_object_story_id']
                        page_id = post_id.split('_')[0]
                        res = await self.call(
                            post_id,
                            params={
                                'fields' : 'call_to_action',
                                'access_token' : page_dict[page_id]
                            }
                        )
                        return res['call_to_action']['value']['link']
                    except:
                        print(ad_name)
                        print(res)

    async def get_page_list(self):
        response = []
        url = 'me/accounts'
        while True:
            res = await self.call(
                url
            )
            for row in res['data']:
                response.append({
                    'access_token' : row['access_token'],
                    'page_name' : row['name'],
                    'page_id' : row['id']
                })
            if 'next' in res['paging']:
                url = res['paging']['next']
            else:
                break
        return response