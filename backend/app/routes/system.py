import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter
from fastapi import HTTPException

from app.config import ALLOWED_ORIGINS


router = APIRouter()


@router.get("/health")
def health():
    return {"ok": True}


@router.get("/debug/cors")
def debug_cors():
    return {
        "allowedOrigins": [origin.strip() for origin in ALLOWED_ORIGINS],
    }


@router.get("/dx-summit/spots")
def get_dx_summit_spots(limit: int = 50):
    bounded_limit = max(1, min(limit, 200))
    query = urlencode(
        {
            "limit": bounded_limit,
            "limit_time": "true",
        }
    )
    request = Request(
        f"http://www.dxsummit.fi/api/v1/spots?{query}",
        headers={
            "User-Agent": "AF0FR-Logbook/1.0",
            "Accept": "application/json",
        },
    )

    try:
        with urlopen(request, timeout=12) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(exc)
        raise HTTPException(
            status_code=502,
            detail="Failed to load DX Summit spots",
        ) from exc
