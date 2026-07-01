from typing import Optional

from pydantic import BaseModel, Field


class NetControlStateUpsert(BaseModel):
    payload: dict = Field(default_factory=dict)


class NetControlSessionUpsert(BaseModel):
    payload: dict = Field(default_factory=dict)


class NetControlRosterMemberUpsert(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    callsign: str = Field(default="", max_length=32)
    name: str = Field(default="", max_length=160)
    city: Optional[str] = Field(default=None, max_length=160)
    notes: Optional[str] = None
    status: str = Field(default="visitor", max_length=20)
    source: str = Field(default="manual", max_length=20)
    lat: Optional[float] = None
    lng: Optional[float] = None
    distanceMiles: Optional[float] = None


class NetControlCheckInCreate(BaseModel):
    id: Optional[str] = Field(default=None, max_length=80)
    callsign: str = Field(default="", max_length=32)
    name: str = Field(default="", max_length=160)
    location: Optional[str] = Field(default=None, max_length=160)
    distance: Optional[float] = None
    trafficType: str = Field(default="regular", max_length=20)
    clubStatus: str = Field(default="visitor", max_length=20)
    visitor: bool = True
    member: bool = False
    memberId: Optional[str] = Field(default=None, max_length=120)
    firstTime: bool = False
    notes: Optional[str] = None
    status: str = Field(default="waiting", max_length=20)
    checkInTime: Optional[str] = None
    logMessage: Optional[str] = None
