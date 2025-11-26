import logging
import logging.handlers
import os
import time
from functools import wraps

from rich.logging import RichHandler

from conf.settings import settings

# from verify_api.conf.settings import LOG_FILE_PATH

# ROOT 로거 이름 지정
ROOT_PKG = "share-posting"
LOG_FILE_PATH = settings.LOG_FILE_PATH

# 로깅 레벨 참고
#   (10)DEBUG:     간단히 문제를 진단하고 싶을 때 필요한 자세한 정보를 기록함
#   (20)INFO:      계획대로 작동하고 있음을 알리는 확인 메시지
#   (30)WARNING:   소프트웨어가 작동은 하고 있지만,
#                  예상치 못한 일이 발생했거나 할 것으로 예측된다는 것을 알림
#   (40)ERROR:     중대한 문제로 인해 소프트웨어가 몇몇 기능들을 수행하지 못함을 알림
#   (50)CRITICAL:  작동이 불가능한 수준의 심각한 에러가 발생함을 알림
RICH_HANDLER_FORMAT = (
    f"{os.getpid()} (%(levelname)s) "
    "%(name)s [%(filename)s:%(funcName)s:%(lineno)s] >> %(message)s"
)

FILE_HANDLER_FORMAT = (
    f"%(asctime)s {os.getpid()} (%(levelname)s) "
    "%(name)s [%(filename)s:%(funcName)s:%(lineno)s] >> %(message)s"
)


def set_logger(
    pkg: str,
    log_base_dir: str = LOG_FILE_PATH,
    log_level: int = logging.INFO,
) -> logging.Logger:
    """pkg 별로 로그를 세분화 하여 기록합니다.

    로깅 위치 = '<log_dir>/<pkg>.log'

    :param pkg: 로깅 대상 패키지 이름
    :type pkg: str
    :param log_dir: 로깅이 수행될 디렉토리 위치
    :type log_dir: str
    :param log_level: 로깅 레벨 지정
    :type log_level: int
    :return: 생성된 로거
    :rtype: logging.Logger
    """
    if not pkg:
        raise Exception(f"pkg(package) must not be None")

    logging.basicConfig(
        level=log_level,
        format=RICH_HANDLER_FORMAT,
        handlers=[RichHandler(rich_tracebacks=True)],
    )
    logger = logging.getLogger(pkg)

    if not logger.handlers:  # 파일 핸들러가 없을 경우에만 추가
        _pkg = pkg.replace("/", "")
        pkg_dirs = [p for p in _pkg.split(".") if p]  # 패키지 이름은 '.' 로 구분
        log_file = pkg_dirs[-1]  # '.' 으로 split 한 값의 맨 마지막은 로그 파일 이름

        # 파일이름을 제외하고 패키지 디렉토리 경로 생성
        pkg_dir = "/".join(pkg_dirs[:-1])
        if pkg_dir:
            log_file_dir = f"{log_base_dir}/{pkg_dir}"
        else:
            log_file_dir = log_base_dir

        # 로그 패키지 디렉토리 폴더 생성 (이미 있으면 스킵)
        os.makedirs(log_file_dir, exist_ok=True)

        # 로그 파일 패스 설정
        log_file_path = f"{log_file_dir}/{log_file}.log"

        file_handler = logging.FileHandler(
            log_file_path, mode="a", encoding="utf-8"
        )
        file_handler.setFormatter(logging.Formatter(FILE_HANDLER_FORMAT))
        logger.addHandler(file_handler)

    return logger


# def handle_exception(exc_type, exc_value, exc_traceback):
#     """예기치 못한 예외 발생 시 ROOT ERR 로거를 사용하여 에러 trace back을 기록"""
#     logger = logging.getLogger(f"{ROOT_PKG}_error")
#     logger.error(
#         "Unexpected exception", exc_info=(exc_type, exc_value, exc_traceback)
#     )


def init_logger():
    """로거 초기 세팅"""
    # sys.excepthook = handle_exception  # 익셉션 핸들러 지정

    _ = set_logger(ROOT_PKG)  # 루트 로거 핸들러 생성
    _ = set_logger(f"{ROOT_PKG}_error")  # 루트 로거 핸들러 생성


init_logger()


def check_func_during(pkg):
    def decor(f):
        @wraps(f)
        async def inner(*args, **kwargs):
            logger = set_logger(pkg)
            start_time = time.time()
            logger.info(f"[{start_time}] Func {f.__name__} is start.\nArguments:\n{kwargs}")
            try:
                res = await f(*args, **kwargs)
            except Exception as e:
                raise e
            finally:
                end_time = time.time()
                duration = end_time - start_time
                logger.info(f"[{start_time}] Func {f.__name__} duration is {duration}.")
            return res
        return inner
    return decor


def aio_log_method_call(pkg):
    """함수 호출시간 / 리턴 시간 / 소요 시간을 기록하여, logging하는 데코레이터 입니다.
    logging level 이 debug 일 때만 동작 합니다.
    """

    def decor(f):
        @wraps(f)
        async def inner(*args, **kwargs):
            logger = set_logger(pkg)

            start_time = time.time()
            logger.debug(
                "Start '{}' func ({}) - args({}) - kwargs({})".format(
                    f.__name__, start_time, args, kwargs
                )
            )
            res = await f(*args, **kwargs)

            end_time = time.time()
            duration = end_time - start_time
            logger.debug(
                "End '{}' func ({}) - duration({})".format(
                    f.__name__, end_time, duration
                )
            )

            return res

        return inner

    return decor


def log_method_call(pkg):
    """함수 호출시간 / 리턴 시간 / 소요 시간을 기록하여, logging하는 데코레이터 입니다.
    logging level 이 debug 일 때만 동작 합니다.
    """

    def decor(f):
        @wraps(f)
        def inner(*args, **kwargs):
            logger = set_logger(pkg)

            start_time = time.time()
            logger.debug(
                "Start '{}' func ({}) - args({}) - kwargs({})".format(
                    f.__name__, start_time, args, kwargs
                )
            )
            res = f(*args, **kwargs)

            end_time = time.time()
            duration = end_time - start_time
            logger.debug(
                "End '{}' func ({}) - duration({})".format(
                    f.__name__, end_time, duration
                )
            )

            return res

        return inner

    return decor
