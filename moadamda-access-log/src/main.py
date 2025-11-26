import asyncio
import sys
from server.server import app, run_debug
import analysis
import scheduler

if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == 'analysis':
            asyncio.run(getattr(analysis,sys.argv[2]).run())
        elif sys.argv[1] == 'scheduler':
            if len(sys.argv) > 4:
                sleep = int(sys.argv[4])
            else:
                sleep = 0
            asyncio.run(scheduler.run(sys.argv[2],sys.argv[3], sleep))
    else:
        run_debug()