from asyncpg import Connection
from asyncpg.exceptions import UniqueViolationError


class Model():
    def __init__(self, pg: Connection):
        self.pg = pg
    async def add_access_log(
        self,url,referer,user_agent,client_ip,cookies, device,navigation_type
    ):
        await self.pg.execute(
            """
                INSERT INTO access_log
                (ip,user_agent,url,referer_url,access_date,cookies, device, navigation_type)
                VALUES
                ($1,$2,$3,$4,now(),$5,$6,$7)
            """,client_ip,user_agent,url,referer,cookies, device,navigation_type
        )
    async def get_access_log(
        self, referer_url, unquote_referer_url, mduuid
    ):
        # access_log = await self.pg.fetchrow(
        #     """
        #         SELECT idx FROM access_log
        #         WHERE referer_url = $1 and cookies->>'_mdUUID' = $2
        #         and (end_date is null or end_date > now() - interval '1 hour')
        #         ORDER BY idx DESC LIMIT 1
        #     """,unquote_referer_url,mduuid
        # )
        # if not access_log:
        #     access_log = await self.pg.fetchrow(
        #         """
        #             SELECT idx FROM access_log
        #             WHERE referer_url = $1 and cookies->>'_mdUUID' = $2
        #             and (end_date is null or end_date > now() - interval '1 hour')
        #             ORDER BY idx DESC LIMIT 1
        #         """,referer_url,mduuid
        #     )
        # if not access_log:
        #     access_log = await self.pg.fetchrow(
        #         """
        #             SELECT idx FROM access_log
        #             WHERE cookies->>'_mdUUID' = $1
        #             and (end_date is null or end_date > now() - interval '1 hour')
        #             ORDER BY idx DESC LIMIT 1
        #         """,mduuid
        #     )
        access_log = await self.pg.fetch(
            """
                SELECT * FROM access_log
                WHERE cookies->>'_mdUUID' = $1
                ORDER BY idx DESC LIMIT 5
            """,mduuid
        )
        return access_log

    async def update_access_log(
        self, log_idx, cookies
    ):
        await self.pg.execute(
            """
                UPDATE access_log
                SET end_date = now(), cookies = $1
                WHERE idx = $2
            """,cookies,log_idx
        )
    async def get_access_log_for_analysis(self, start_date, end_date):
        return await self.pg.fetch(
            """
                select
                    ip,
                    substring(url FROM 'utm_source=([^&]+)') AS utm_source,
                    (substring((url) FROM 'utm_campaign=([^&]+)')) AS utm_campaign,
                    (substring((url) FROM 'utm_content=([^&]+)')) AS utm_content,
                    substring(url FROM 'utm_medium=([^&]+)') AS utm_medium,
                    substring(url FROM 'utm_term=([^&]+)') AS utm_term,
                    substring(url FROM 'fbclid=([^&]+)') AS fbclid,
                    url,
                    access_date,
                    end_date
                FROM access_log where url like '%utm_source=%' and url not like '%{{%' and access_date > $1 and access_date <= $2
            """,start_date, end_date
        )
    async def add_error_log(self, url, message, source, lineno, colno, stack):
        await self.pg.execute(
            """
                INSERT INTO error_log
                (message,source,lineno,colno,stack,url,created_at)
                VALUES
                ($1,$2,$3,$4,$5,$6,now())
            """,message,source,lineno,colno,stack,url
        )
    async def get_user_info_from_uuid(
        self, uuid
    ):
        row = await self.pg.fetchrow(
            """
                SELECT ip, cookies, cookies->>'_mdUUID' as uuid, device, access_date
                FROM access_log
                WHERE cookies->>'_mdUUID' = $1
                ORDER BY idx DESC LIMIT 1
            """,uuid
        )
        return row
    async def get_user_info_from_order_id(
        self, order_id
    ):
        row = await self.pg.fetchrow(
            """
                SELECT ip, cookies, cookies->>'_mdUUID' as uuid, device, access_date
                FROM access_log
                WHERE url like $1 AND url like '%order_result%'
                AND access_date > now() - interval '3 hour'
                ORDER BY idx DESC LIMIT 1
            """,f"%{order_id}%"
        )
        if not row:
            row = await self.pg.fetchrow(
            """
                SELECT ip, cookies->>'_mdUUID' as uuid, device, access_date
                FROM access_log
                WHERE url like $1
                AND access_date > now() - interval '3 hour'
                ORDER BY idx DESC LIMIT 1
            """,f"%{order_id}%"
        )
        return row
    async def get_user_info_from_member_id(
        self, member_id
    ):
        row = await self.pg.fetchrow(
            """
                SELECT ip, cookies, cookies->>'_mdUUID' as uuid, device, access_date
                FROM access_log
                WHERE cookies->>'_LOGINID' = $1
                AND access_date > now() - interval '3 hour'
                ORDER BY idx DESC LIMIT 1
            """,member_id
        )
        if not row:
            row = await self.pg.fetchrow(
                """
                    SELECT ip, cookies, cookies->>'_mdUUID' as uuid, device, access_date
                    FROM access_log
                    WHERE cookies->'login_provider_1'->>'member_id' = $1
                    AND access_date > now() - interval '3 hour'
                    ORDER BY idx DESC LIMIT 1
                """,member_id
            )
        return row
    async def get_access_log_from_ip(self, ip):
        return await self.pg.fetch(
            """
                SELECT access_date, end_date, url, navigation_type FROM access_log
                WHERE ip = $1
                ORDER BY idx ASC
            """,ip
        )
    async def get_access_log_from_uuid(self, uuid):
        return await self.pg.fetch(
            """
                SELECT access_date, end_date, url, navigation_type FROM access_log
                WHERE cookies->>'_mdUUID' = $1
                ORDER BY idx ASC
            """,uuid
        )
    async def get_order_success_list(self, start_date, end_date):
        return await self.pg.fetch(
            """
                SELECT url
                FROM access_log
                WHERE url LIKE '%order_result%'
                AND access_date >= $1
                AND access_date < $2
            """,start_date,end_date
        )

