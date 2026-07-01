from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import ALLOWED_ORIGINS
from app.routes import azimuth, cw, net_control, system
from app.schema import initialize_schema


def create_app() -> FastAPI:
    app = FastAPI(title="AF0FR API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def startup():
        initialize_schema()

    app.include_router(system.router)
    app.include_router(net_control.router)
    app.include_router(cw.router)
    app.include_router(azimuth.router)

    return app


app = create_app()
