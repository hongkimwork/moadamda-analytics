import traceback
from enum import Enum
from http import HTTPStatus
from typing import Any, Dict, List, Type, Union

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from common.logger import ROOT_PKG, set_logger


class Error(Exception):
    pass


class InternalError(Error):
    pass


class AppErrorCode(Enum):
    """에러 코드에 대해 정의 합니다.

    response code 는 6자리로 구성됩니다.
        - 앞   두자리 : 대분류 구분
        - 중간  두자리 : 중분류 구분
        - 끝   두자리 : 상세

    000000 : 성공, 그 외에는 다 실패
    000001 ~ 099999 는 공통

    990001 ~ 999999 는 내부 오류 (디버깅 용)
    """

    # ---------- 기본 공통 에러 ----------
    SUCCESS = ("000000", "성공")
    DEFAULT_ERROR = ("000001", "분류되지 않은 내부 서버 에러가 발생했습니다.")
    SERVER_ERROR = ("000099", "내부 서버 오류가 발생했습니다.")

    # ---------- 요청값 관련 에러 (0001xx) ----------
    PARAMETER_REQUIRED = ("000103", "필수 파라미터가 전달되지 않았습니다. (내부 API)")

    def __init__(
        self,
        code: str,
        message: str,
    ) -> None:
        if len(code) != 6:
            raise Error(f"Error code is must be 6 digit ({code}/{message})")

        self.code = code
        self.message = message

    def dict(self) -> dict:
        res = {
            "code": self.code,
            "message": f"{self.message}",
        }

        return res


class AppError(Error):
    def __init__(
        self,
        err: AppErrorCode,
        *args,
        raw_err: Union[Type[Exception], None] = None,
        description: Union[List[str], str, None] = None,
    ) -> None:
        """
        각각의 Application 에서 사용할 Exception 을 정의 합니다.
        해당 Exception이 발생하는 경우 HTTP 400 코드로 응답 합니다.

        :param err: AppErrorCode 값
        :type err: AppErrorCode
        :param raw_err: AppError가 아닌, Exception 인스턴스
        :type raw_err: Union[Type[Exception], None], optional
        :param description: 해당 에러에 대한 설명
        :type description: Union[List[str], str, None], optional
        """
        self.err = err
        self.message = err.value[1].format(*args)
        self.err.message = self.message
        self.raw_err = raw_err
        self.description = []
        if isinstance(description, list):
            self.description.extend(description)
        elif description:
            self.description.append(str(description))

        super().__init__(self.message)

    @property
    def msg(self):
        return self.args[0]

    def append_desc(self, obj: object) -> None:
        if isinstance(obj, list):
            self.description.extend(obj)
        elif obj:
            self.description.append(str(obj))

    def dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = self.err.dict()
        d["detail"] = self.description
        return d

    def is_network_error(self) -> bool:
        return self.err.is_network_error()

    @staticmethod
    def convert_to_app_error(e: Any) -> "AppError":
        """AppError 가 아닌 Exception 인스턴스를 AppError 로 변환 합니다."""
        if isinstance(e, AppError):
            return e

        err_code = AppErrorCode.DEFAULT_ERROR
        if hasattr(e, "get_app_error_code"):
            err_code = e.get_app_error_code()

        return AppError(
            err_code,
            description=e,
            raw_err=e,
        )


_LOGGER_5XX: Any = set_logger(f"{ROOT_PKG}.error_hanlder_5xx")
_LOGGER_4XX: Any = set_logger(f"{ROOT_PKG}.error_hanlder_4xx")


class AppErrorHandler(object):
    """FastAPI 에서 사용할 에러 핸들러를 정의 합니다."""

    @staticmethod
    async def app_error_exc_handler(request, exc: AppError):
        """
        개발자가 정의 (또는 의도한) 에러가 발생하는 경우
        필요한 에러는 로깅 및 400 / JsonError 리턴 처리
        """
        text_build: List[str] = []
        exc_dict: Dict[str, Any] = exc.dict()

        text_build.append('400 client error')
        text_build.append(f'error code : {exc_dict["code"]}')
        text_build.append(f'error message : {exc_dict["message"]}')
        text_build.append(f'error detail')
        text_build.extend(exc_dict['detail'])
        text_build.extend(traceback.format_exc().split('\n'))

        # TODO. debug 로 조정 (정환: 굳이 debug 로 갈 필요 없어 보입니다?)
        _LOGGER_4XX.error('\n'.join(text_build))

        return JSONResponse(
            status_code=HTTPStatus.BAD_REQUEST,
            content=jsonable_encoder(
                exc_dict,
            ),
        )

    @staticmethod
    async def request_validation_exc_handler(request, exc):
        """
        NOTE. Not used

        FastAPI 에서 잘못된 파라미터 요청이 오는 경우,
        관련 사항 로깅 및 422 / JsonError 리턴 처리
        """
        text_build: List[str] = []
        text_build.append(f'422 error')
        text_build.append(f'url : {request.url}')
        text_build.append(f'method : {request.method}')
        text_build.append(f'message : {exc.args[0][0].exc} \n {exc.args[0][0]._loc}')

        _LOGGER_4XX.error('\n'.join(text_build))

        return JSONResponse(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,  # 422
            content=jsonable_encoder(AppErrorCode.PARAMETER_REQUIRED.dict()),
        )

    @staticmethod
    async def exc_handler(request, exc):
        """
        FastAPI 에서 잘못된 파라미터 요청이 오는 경우,
        관련 사항 로깅 및 500 / JsonError 리턴 처리
        """
        text_build: List[str] = []
        text_build.append('500 internal error')
        text_build.append(f'message : {str(exc) or type(exc)}')
        text_build.extend(traceback.format_exc().split('\n'))

        _LOGGER_5XX.error('\n'.join(text_build))

        return JSONResponse(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,  # 500
            content=jsonable_encoder(AppErrorCode.SERVER_ERROR.dict()),
        )
