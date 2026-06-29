from datetime import date, time
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


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
    sourcePointId: Optional[UUID] = None


class AzimuthLineUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=120)
    toLat: Optional[float] = None
    toLng: Optional[float] = None
    bearingDeg: Optional[float] = None
    distanceMiles: Optional[float] = None
    sourcePointId: Optional[UUID] = None


class AzimuthReportUpdate(BaseModel):
    reportId: Optional[UUID] = None


class ReportPointCreate(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    lat: float
    lng: float
    createdBy: Optional[str] = Field(default=None, max_length=80)
    reportId: Optional[UUID] = None


class ReportPointUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=120)
    lat: Optional[float] = None
    lng: Optional[float] = None


class PointReportUpdate(BaseModel):
    reportId: Optional[UUID] = None


class SightingReportCreate(BaseModel):
    callsign: str = Field(min_length=1, max_length=80)
    reportDate: date
    reportTime: time
    sourceLabel: str = Field(min_length=1, max_length=120)
    frequencyMhz: str = Field(min_length=1, max_length=40)
    notes: Optional[str] = Field(default=None, max_length=1000)
