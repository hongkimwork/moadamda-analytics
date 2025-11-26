import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Any
import logging

import uvicorn
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from core import postgres
from core.cafe24 import Cafe24
from server.api.router import router as api_router
from server.error_handler import AppError, AppErrorHandler

logger = logging.getLogger(__name__)

app = FastAPI(
    title="moadamda",docs_url=None, redoc_url=None
)

app.include_router(api_router, prefix="")

app.add_exception_handler(AppError, AppErrorHandler.app_error_exc_handler)
app.add_exception_handler(Exception, AppErrorHandler.exc_handler)



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def token_refresh_task():
    """1시간마다 Cafe24 토큰을 갱신하는 백그라운드 태스크"""
    # PostgreSQL Advisory Lock으로 여러 워커 중 하나만 실행되도록 제어
    ADVISORY_LOCK_ID = 123456789  # 고유한 락 ID

    pool = await postgres.init_pool()
    conn = await pool.acquire()

    try:
        # 락 획득 시도
        lock_acquired = await conn.fetchval(
            "SELECT pg_try_advisory_lock($1)", ADVISORY_LOCK_ID
        )

        if not lock_acquired:
            logger.info("Cafe24 토큰 갱신 태스크는 이미 다른 워커에서 실행 중입니다.")
            await pool.release(conn)
            return

        logger.info("Cafe24 토큰 갱신 태스크 락 획득 성공 - 이 워커에서 실행합니다.")

        cafe24 = Cafe24()
        while True:
            try:
                await asyncio.sleep(3600)  # 1시간 대기
                token = await cafe24.get_token()
                logger.info(f"Cafe24 토큰 갱신 완료: {token[:20]}...")
            except Exception as e:
                logger.error(f"Cafe24 토큰 갱신 실패: {e}")
    except Exception as e:
        logger.error(f"Cafe24 토큰 갱신 태스크 초기화 실패: {e}")
        await pool.release(conn)


@app.on_event("startup")
async def _init():
    await postgres.init_pool()
    asyncio.create_task(token_refresh_task())
    logger.info("Cafe24 토큰 자동 갱신 백그라운드 태스크 시작")


@app.on_event("shutdown")
async def shutdown():
    await postgres.release_pool()

def run_debug():
    uvicorn.run("main:app", host="0.0.0.0", port=8888, reload=True)
