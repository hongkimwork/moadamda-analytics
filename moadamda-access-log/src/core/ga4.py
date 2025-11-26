import datetime
import aiohttp
from conf.settings import settings
from core.postgres import connection

class GA4:
    def __init__(self):
        self.measurement_id = settings.GA4_MEASUREMENT_ID
        self.api_secret = settings.GA4_API_SECRET

    async def call(self,url,method='post',**kwargs):
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
                return await resp.text()

    async def send_purchase_info(self,ga_id,event_name,order_info):
        client_id = ga_id.split('.')[-2] + '.' + ga_id.split('.')[-1]
        order_items = []
        for item in order_info['items']:
            order_items.append(
                {
                    'item_id' : item['item_no'],
                    'item_name' : item['product_name'],
                    'currency' : order_info['currency'],
                    'item_variant' : '',
                    'price' : int(item['payment_amount'].split('.')[0]),
                    'quantity' : item['quantity'],
                    'item_category' : '전체상품',
                    'item_category2' : '',
                    'item_category3' : '',
                    'item_category4' : '',
                }
            )
        event_obj = {
            'name' : event_name,
            'params' : {
                'currency' : order_info['currency'],
                'value' : int(order_info['payment_amount'].split('.')[0]),
                'items' : order_items,
                'transaction_id' : order_info['order_id'],
                'shipping' : 0, #TODO. 배송비 넣어야함
            }
        }
        return await self.call(
            f'https://www.google-analytics.com/mp/collect?measurement_id={self.measurement_id}&api_secret={self.api_secret}',
            method='post',
            json={
                'client_id' : client_id,
                'events' : [
                    event_obj
                ]
            }
        )