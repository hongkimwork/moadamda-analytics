import datetime
import aiohttp
import asyncio
from conf.settings import settings
from core.postgres import connection

class Cafe24:
    async def get_header(self):
        return {
            'Authorization' : f'Basic {await self.get_token()}',
            'Content-Type' : 'application/json',
            # 'X-Cafe24-Api-Version' : '2024-06-01'
        }
    async def call(self,url,method='get',**kwargs):
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
                    headers=await self.get_header(),
                    **kwargs
                ) as resp:
                    if resp.status == 429:
                        await asyncio.sleep(3)
                        continue
                    return await resp.json()

    async def get_token(self,):
        async with connection() as session:
            row = await session.fetchrow(
                """
                    SELECT * FROM cafe24_token ORDER BY idx DESC limit 1
                """
            )
            if row['expire_date'] < datetime.datetime.now():
                return await self.refresh_token(row['refresh_token'])
            else:
                return row['access_token']

    async def refresh_token(self,refresh_token):
        async with aiohttp.ClientSession() as session:
            async with session.post(
                'https://moadamda.cafe24api.com/api/v2/oauth/token',
                data={
                    'grant_type' : 'refresh_token',
                    'refresh_token' : refresh_token
                },
                headers={
                    'Authorization' : f'Basic {settings.CAFE24_AUTH_KEY}',
                    'Content-Type' : 'application/x-www-form-urlencoded'
                }
            ) as resp:
                res = await resp.json()
                access_token = res['access_token']
                expire_date = res['expires_at']
                refresh_token = res['refresh_token']
                async with connection() as session:
                    await session.execute(
                        """
                            INSERT INTO cafe24_token
                            (access_token,refresh_token,issued_date,expire_date)
                            VALUES
                            ($1,$2,now(),$3)
                        """,access_token,refresh_token,datetime.datetime.strptime(expire_date, '%Y-%m-%dT%H:%M:%S.%f')
                    )
                return access_token

    async def get_order_info(self,order_id):
        return await self.call(f'https://moadamda.cafe24api.com/api/v2/admin/orders/{order_id}?embed=items')

    async def get_buyer_info(self,order_id):
        return await self.call(f'https://moadamda.cafe24api.com/api/v2/admin/orders/{order_id}/buyer')

    async def get_member_info(self,member_id):
        return await self.call(f'https://moadamda.cafe24api.com/api/v2/admin/customers?member_id={member_id}')

    async def get_member_order_history(self,**kwargs):
        querys = ['embed=items']
        for key,value in kwargs.items():
            querys.append(f'{key}={value}')
        return await self.call(f'https://moadamda.cafe24api.com/api/v2/admin/orders?{'&'.join(querys)}')
    async def edit_order_options(self,order_id,order_item_id,options):
        return await self.call(
            f'https://moadamda.cafe24api.com/api/v2/admin/orders/{order_id}/items/{order_item_id}/options',
            method='post',
            json={
                'shop_no' : 1,
                'request' : {
                    "product_bundle": "F",
                    'additional_options' : options
                }
            }
        )
    async def get_product_list(self,offset=0,limit=100):
        return await self.call(
            f'https://moadamda.cafe24api.com/api/v2/admin/products?offset={offset}&limit={limit}&embed=options'
        )

    async def add_product_additional_options(self,product_number,additional_options):
        return await self.call(
            f'https://moadamda.cafe24api.com/api/v2/admin/products/{product_number}/options',
            method='put',
            json={
                'shop_no' : 1,
                'request' : {
                    'use_additional_option' : 'T',
                    'additional_options':additional_options
                }
            }
        )