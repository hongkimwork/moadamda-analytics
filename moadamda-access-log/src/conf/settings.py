from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    LOG_FILE_PATH: str
    POSTGRES_PASSWORD: str
    POSTGRES_USER: str
    POSTGRES_DB: str
    POSTGRES_HOSTNAME: str

    SLACK_BOT_TOKEN: str
    CAFE24_AUTH_KEY: str

    SLACK_STATUS_CHANNEL_ID: str
    SESSION_OPTION_NAME: str

    GA4_MEASUREMENT_ID: str
    GA4_API_SECRET: str

    CLARITY_COOKIE: str
    CLARITY_CSRF: str
    CLARITY_ID: str

    META_APP_ID: str
    META_APP_SECRET: str
    META_ACCESS_TOKEN: str
    META_AD_ACCOUNT_ID: str

    class Config:
        config_path = Path(__file__)
        env_file = f"{config_path.parent.parent.parent}/.env"


settings = Settings()
