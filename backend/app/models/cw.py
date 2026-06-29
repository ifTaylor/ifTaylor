from typing import Optional

from pydantic import BaseModel, Field


class CwPracticeAttemptCreate(BaseModel):
    operator: str = Field(min_length=1, max_length=80)
    mode: str = Field(min_length=1, max_length=40)
    drill: str = Field(default="", max_length=80)
    accuracy: int = Field(ge=0, le=100)
    correctCharacters: int = Field(ge=0)
    totalCharacters: int = Field(ge=1)
    wpm: int = Field(ge=5, le=100)
    farnsworthWpm: int = Field(ge=5, le=100)
    durationSeconds: float = Field(default=0, ge=0, le=7200)
    missedCharacters: dict[str, int] = Field(default_factory=dict)
    characterScores: dict[str, int] = Field(default_factory=dict)
    confusions: dict[str, int] = Field(default_factory=dict)
    trainingGoal: Optional[str] = Field(default=None, max_length=40)
    exerciseFormat: Optional[str] = Field(default=None, max_length=40)
    audioEffect: Optional[str] = Field(default=None, max_length=40)
    repeatCount: Optional[int] = Field(default=None, ge=1, le=3)
    groupSize: Optional[int] = Field(default=None, ge=1, le=8)
    strictSpacing: Optional[bool] = None
    timedMinutes: Optional[int] = Field(default=None, ge=0, le=5)
    playCount: Optional[int] = Field(default=None, ge=1, le=100)
    revealedBeforeCheck: Optional[bool] = None
    sessionId: Optional[str] = Field(default=None, max_length=80)
    characterAttempts: dict[str, int] = Field(default_factory=dict)
    characterCorrect: dict[str, int] = Field(default_factory=dict)
    missingCount: Optional[int] = Field(default=None, ge=0)
    incorrectCount: Optional[int] = Field(default=None, ge=0)
    extraCount: Optional[int] = Field(default=None, ge=0)


class CwOperatorProfileUpsert(BaseModel):
    callsign: str = Field(min_length=1, max_length=16)
    name: str = Field(default="", max_length=80)
    qth: str = Field(default="", max_length=120)
    rig: str = Field(default="", max_length=120)
    antenna: str = Field(default="", max_length=120)
    power: str = Field(default="", max_length=40)
    settings: dict = Field(default_factory=dict)
