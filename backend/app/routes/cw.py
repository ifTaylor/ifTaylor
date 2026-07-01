from uuid import uuid4

from fastapi import APIRouter, HTTPException
from psycopg.types.json import Jsonb

from app.controllers.common import normalize_callsign
from app.controllers.cw import cw_attempt_row_to_dict, cw_operator_row_to_dict
from app.db import get_connection
from app.models.cw import CwOperatorProfileUpsert, CwPracticeAttemptCreate


router = APIRouter()


@router.get("/cw-operators/{callsign}")
def get_cw_operator(callsign: str):
    operator = normalize_callsign(callsign)
    if not operator:
        raise HTTPException(status_code=400, detail="Invalid operator callsign")

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select
                        callsign,
                        name,
                        qth,
                        rig,
                        antenna,
                        power,
                        settings,
                        created_at,
                        updated_at
                    from cw_operators
                    where callsign = %s
                    """,
                    (operator,),
                )
                row = cur.fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail="CW operator not found")

        return cw_operator_row_to_dict(row)

    except HTTPException:
        raise
    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to load CW operator",
        ) from exc


@router.put("/cw-operators/{callsign}")
def upsert_cw_operator(callsign: str, profile: CwOperatorProfileUpsert):
    operator = normalize_callsign(callsign or profile.callsign)
    if not operator:
        raise HTTPException(status_code=400, detail="Invalid operator callsign")

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    insert into cw_operators (
                        callsign,
                        name,
                        qth,
                        rig,
                        antenna,
                        power,
                        settings
                    )
                    values (%s, %s, %s, %s, %s, %s, %s)
                    on conflict (callsign) do update set
                        name = excluded.name,
                        qth = excluded.qth,
                        rig = excluded.rig,
                        antenna = excluded.antenna,
                        power = excluded.power,
                        settings = excluded.settings,
                        updated_at = now()
                    returning
                        callsign,
                        name,
                        qth,
                        rig,
                        antenna,
                        power,
                        settings,
                        created_at,
                        updated_at
                    """,
                    (
                        operator,
                        profile.name.strip().upper(),
                        profile.qth.strip().upper(),
                        profile.rig.strip().upper(),
                        profile.antenna.strip().upper(),
                        profile.power.strip().upper(),
                        Jsonb(profile.settings),
                    ),
                )
                row = cur.fetchone()

        return cw_operator_row_to_dict(row)

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to save CW operator",
        ) from exc


@router.get("/cw-practice-attempts")
def list_cw_practice_attempts(operator: str, limit: int = 300):
    safe_limit = min(max(limit, 1), 1000)
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select
                        id,
                        operator,
                        mode,
                        drill,
                        accuracy,
                        correct_characters,
                        total_characters,
                        wpm,
                        farnsworth_wpm,
                        duration_seconds,
                        missed_characters,
                        character_scores,
                        confusions,
                        training_goal,
                        exercise_format,
                        audio_effect,
                        repeat_count,
                        group_size,
                        strict_spacing,
                        timed_minutes,
                        play_count,
                        revealed_before_check,
                        session_id,
                        character_attempts,
                        character_correct,
                        missing_count,
                        incorrect_count,
                        extra_count,
                        created_at
                    from cw_practice_attempts
                    where upper(operator) = upper(%s)
                    order by created_at desc
                    limit %s
                    """,
                    (operator.strip(), safe_limit),
                )
                rows = cur.fetchall()

        return [cw_attempt_row_to_dict(row) for row in rows]

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to load CW practice attempts",
        ) from exc


@router.post("/cw-practice-attempts", status_code=201)
def create_cw_practice_attempt(attempt: CwPracticeAttemptCreate):
    try:
        attempt_id = uuid4()
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    insert into cw_practice_attempts (
                        id,
                        operator,
                        mode,
                        drill,
                        accuracy,
                        correct_characters,
                        total_characters,
                        wpm,
                        farnsworth_wpm,
                        duration_seconds,
                        missed_characters,
                        character_scores,
                        confusions,
                        training_goal,
                        exercise_format,
                        audio_effect,
                        repeat_count,
                        group_size,
                        strict_spacing,
                        timed_minutes,
                        play_count,
                        revealed_before_check,
                        session_id,
                        character_attempts,
                        character_correct,
                        missing_count,
                        incorrect_count,
                        extra_count
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    returning
                        id,
                        operator,
                        mode,
                        drill,
                        accuracy,
                        correct_characters,
                        total_characters,
                        wpm,
                        farnsworth_wpm,
                        duration_seconds,
                        missed_characters,
                        character_scores,
                        confusions,
                        training_goal,
                        exercise_format,
                        audio_effect,
                        repeat_count,
                        group_size,
                        strict_spacing,
                        timed_minutes,
                        play_count,
                        revealed_before_check,
                        session_id,
                        character_attempts,
                        character_correct,
                        missing_count,
                        incorrect_count,
                        extra_count,
                        created_at
                    """,
                    (
                        attempt_id,
                        attempt.operator.strip().upper(),
                        attempt.mode,
                        attempt.drill,
                        attempt.accuracy,
                        attempt.correctCharacters,
                        attempt.totalCharacters,
                        attempt.wpm,
                        attempt.farnsworthWpm,
                        attempt.durationSeconds,
                        Jsonb(attempt.missedCharacters),
                        Jsonb(attempt.characterScores),
                        Jsonb(attempt.confusions),
                        attempt.trainingGoal,
                        attempt.exerciseFormat,
                        attempt.audioEffect,
                        attempt.repeatCount,
                        attempt.groupSize,
                        attempt.strictSpacing,
                        attempt.timedMinutes,
                        attempt.playCount,
                        attempt.revealedBeforeCheck,
                        attempt.sessionId,
                        Jsonb(attempt.characterAttempts),
                        Jsonb(attempt.characterCorrect),
                        attempt.missingCount,
                        attempt.incorrectCount,
                        attempt.extraCount,
                    ),
                )
                row = cur.fetchone()

        return cw_attempt_row_to_dict(row)

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to save CW practice attempt",
        ) from exc
