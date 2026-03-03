from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    MAILERSEND_API_KEY: str
    MAILERSEND_DOMAIN: str
    MAILERSEND_RECIPIENT: str
    ENVIRONMENT: str = "development"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()