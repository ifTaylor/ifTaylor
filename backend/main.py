import os
from datetime import date, time
from typing import Optional
from uuid import UUID

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:4200",
).split(",")

app = FastAPI(title="AF0FR Azimuth Map API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
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
    reportId: Optional[UUID] = None


class SightingReportCreate(BaseModel):
    callsign: str = Field(min_length=1, max_length=80)
    reportDate: date
    reportTime: time
    sourceLabel: str = Field(min_length=1, max_length=120)
    frequencyMhz: str = Field(min_length=1, max_length=40)
    notes: Optional[str] = Field(default=None, max_length=1000)

class AzimuthReportUpdate(BaseModel):
    reportId: Optional[UUID] = None


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
        "reportId": str(row[10]) if row[10] else None,
    }


def report_row_to_dict(row):
    return {
        "id": str(row[0]),
        "callsign": row[1],
        "reportDate": row[2].isoformat(),
        "reportTime": row[3].strftime("%H:%M"),
        "sourceLabel": row[4],
        "frequencyMhz": row[5],
        "notes": row[6],
        "createdAt": row[7].isoformat(),
    }


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/debug/cors")
def debug_cors():
    return {
        "allowedOrigins": [origin.strip() for origin in ALLOWED_ORIGINS],
    }


@app.get("/sighting-reports")
def list_sighting_reports():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select
                        id,
                        callsign,
                        report_date,
                        report_time,
                        source_label,
                        frequency_mhz,
                        notes,
                        created_at
                    from sighting_reports
                    order by created_at desc
                    """
                )
                rows = cur.fetchall()

        return [report_row_to_dict(row) for row in rows]

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to load sighting reports",
        ) from exc


@app.post("/sighting-reports", status_code=201)
def create_sighting_report(report: SightingReportCreate):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    insert into sighting_reports (
                        callsign,
                        report_date,
                        report_time,
                        source_label,
                        frequency_mhz,
                        notes
                    )
                    values (%s, %s, %s, %s, %s, %s)
                    returning
                        id,
                        callsign,
                        report_date,
                        report_time,
                        source_label,
                        frequency_mhz,
                        notes,
                        created_at
                    """,
                    (
                        report.callsign,
                        report.reportDate,
                        report.reportTime,
                        report.sourceLabel,
                        report.frequencyMhz,
                        report.notes,
                    ),
                )
                row = cur.fetchone()

        return report_row_to_dict(row)

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to save sighting report",
        ) from exc


@app.delete("/sighting-reports/{report_id}", status_code=204)
def delete_sighting_report(report_id: UUID):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "delete from sighting_reports where id = %s",
                    (report_id,),
                )

        return None

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to delete sighting report",
        ) from exc


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
                        created_at,
                        report_id
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
                        created_by,
                        report_id
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                        created_at,
                        report_id
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
                        line.reportId,
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

@app.patch("/azimuth-lines/{line_id}/report")
def update_azimuth_line_report(line_id: UUID, update: AzimuthReportUpdate):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    update azimuth_lines
                    set report_id = %s
                    where id = %s
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
                        created_at,
                        report_id
                    """,
                    (
                        update.reportId,
                        line_id,
                    ),
                )
                row = cur.fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Azimuth line not found",
            )

        return row_to_dict(row)

    except HTTPException:
        raise

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to update azimuth report link",
        ) from exc