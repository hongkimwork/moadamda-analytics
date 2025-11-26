
import json
import asyncio
from datetime import datetime
from typing import Any, Optional, Union

from fastapi import APIRouter, Body, Depends, Form, Header, Query, Request, BackgroundTasks
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, PlainTextResponse

from core.postgres import return_connection as pg_connection, connection
from server.api.controller import Controller


async def get_controller(
    pg=Depends(pg_connection)
):
    return Controller(pg)

router = APIRouter()

@router.post('/access')
async def add_access_log(
    url: str = Body(...),
    referer: str = Body(...),
    user_agent:str = Body(...),
    client_ip:str = Body(...),
    cookies: str = Body(...),
    log_type:str = Body(...),
    device:str = Body(...),
    navigation_type:str = Body(...),
    controller: Controller = Depends(get_controller)
):
    await controller.add_access_log(
        url, referer,user_agent, client_ip, cookies, log_type, device, navigation_type
    )
@router.post('/error')
async def add_error_log(
    url: str = Body(...),
    message: str = Body(''),
    source: str = Body(''),
    lineno: int = Body(...),
    colno: int = Body(...),
    stack: str = Body(''),
    controller: Controller = Depends(get_controller)
):
    await controller.add_error_log(
        url,message,source,lineno,colno,stack
    )
@router.get('/')
async def test(controller: Controller = Depends(get_controller)):

    await controller.test()

@router.get('/log/{start_date}/{end_date}')
async def get_log(
    start_date: str,
    end_date: str,
    controller: Controller = Depends(get_controller)
):
    return await controller.get_log(start_date, end_date)

@router.get('/status')
async def testt(controller: Controller = Depends(get_controller)):
    await controller.send_status()

@router.get('/add_options')
async def add_options(controller: Controller = Depends(get_controller)):
    await controller.add_options()

@router.post('/slack/events')
async def slack_events(
    request: Request,
):
    data = await request.json()
    if 'challenge' in data:
        return JSONResponse(content={"challenge": data['challenge']})
    if 'bot_id' in data['event'] and data['event']['bot_id'] == 'B07AUUEN2M6':
        return JSONResponse(content={"status": "ok"})
    try:
        if data['event']['message']['bot_id'] == 'B07AUUEN2M6':
            return JSONResponse(content={"status": "ok"})
    except:
        pass
    print(data)
    controller = Controller(None)
    asyncio.create_task(controller.process_slack_message(
        data['event']['ts'],
        data['event']['text'],
        data['event']['channel']
    ))
    return JSONResponse(content={"status": "ok"})