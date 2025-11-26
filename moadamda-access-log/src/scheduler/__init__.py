import asyncio
import time
from . import meta
from . import clarity

async def run(module,function,sleep):
    ref = None
    if module == 'meta':
        ref = getattr(meta,function)
    elif module == 'clarity':
        ref = getattr(clarity,function)

    loop_count = 0
    while True:
        start_time = time.time()
        print(f'start - {module} - {function} - {loop_count}')
        await ref.run()
        end_time = time.time()
        elapsed = end_time - start_time
        print(f'end. elapsed - {elapsed}')
        loop_count += 1
        if elapsed < sleep:
            print(f'sleep - {sleep - elapsed} sec')
            await asyncio.sleep(sleep - elapsed)
        elif sleep == -1:
            return