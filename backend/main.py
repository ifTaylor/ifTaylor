import os
from typing import Optional
from uuid import UUID

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "http://localhost:4200")

app = FastAPI(title="AF0FR Azimuth Map API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


class AzimuthLineCreate(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    fromLat: float
    fromLng: float
    toLat: float
    toLng: float
    bearingDeg: float
    distanceMiles: float
    createdBy: Optional[str] = Field(default=None, max_length=80)


def get_connection():
    return psycopg.connect(DATABASE_URL)


def row_to_dict(row):
    return {
        "id": str(row[0]),
        "label": row[1],
        "fromLat": row[2],
        "fromLng": row[3],
        "toLat": row[4],
        "toLng": row[5],
        "bearingDeg": row[6],
        "distanceMiles": row[7],
        "createdBy": row[8],
        "createdAt": row[9].isoformat(),
    }


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/azimuth-lines")
def list_azimuth_lines():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select
                        id,
                        label,
                        from_lat,
                        from_lng,
                        to_lat,
                        to_lng,
                        bearing_deg,
                        distance_miles,
                        created_by,
                        created_at
                    from azimuth_lines
                    order by created_at desc
                    """
                )
                rows = cur.fetchall()

        return [row_to_dict(row) for row in rows]

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to load azimuth lines",
        ) from exc


@app.post("/azimuth-lines", status_code=201)
def create_azimuth_line(line: AzimuthLineCreate):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    insert into azimuth_lines (
                        label,
                        from_lat,
                        from_lng,
                        to_lat,
                        to_lng,
                        bearing_deg,
                        distance_miles,
                        created_by
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s)
                    returning
                        id,
                        label,
                        from_lat,
                        from_lng,
                        to_lat,
                        to_lng,
                        bearing_deg,
                        distance_miles,
                        created_by,
                        created_at
                    """,
                    (
                        line.label,
                        line.fromLat,
                        line.fromLng,
                        line.toLat,
                        line.toLng,
                        line.bearingDeg,
                        line.distanceMiles,
                        line.createdBy,
                    ),
                )
                row = cur.fetchone()

        return row_to_dict(row)

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to save azimuth line",
        ) from exc


@app.delete("/azimuth-lines/{line_id}", status_code=204)
def delete_azimuth_line(line_id: UUID):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "delete from azimuth_lines where id = %s",
                    (line_id,),
                )

        return None

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to delete azimuth line",
        ) from exc