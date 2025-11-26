import asyncio
import json
import traceback
from contextlib import asynccontextmanager

import asyncpg
from asyncpg.connection import Connection
from asyncpg.pool import Pool

from conf.settings import settings

POOL = None

DATABASES = {}


async def init_pool() -> Pool:
    # 풀을 사용하면 코드는 좀 복잡해지지만 '대부분의 경우' 성능이 좋아짐
    # 풀을 사용했을 때 중간에 디비가 껐다 켜져도 꺼진 동안에만 오류나고 자동 복구 됨
    global POOL
    if POOL is None:
        POOL = await asyncpg.create_pool(
            host=settings.POSTGRES_HOSTNAME,
            password=settings.POSTGRES_PASSWORD,
            user=settings.POSTGRES_USER,
            database=settings.POSTGRES_DB,
        )
    return POOL


async def release_pool():
    global POOL
    if POOL:
        await POOL.close()


@asynccontextmanager
async def connection():
    pool = await init_pool()
    async with pool.acquire() as session:
        yield session


async def return_connection():
    pool = await init_pool()
    conn = await pool.acquire()
    try:
        yield conn
    finally:
        await pool.release(conn)


async def release_connection(connection):
    pool = await init_pool()
    await pool.release(connection)


@asynccontextmanager
async def transaction(conn: Connection):
    # 중첩 트랜젝션 허용 안함
    try:
        if conn.is_in_transaction():
            yield conn
        else:
            async with conn.transaction():
                yield conn
    except Exception as e:
        print(e)  # debug 용
        raise e
