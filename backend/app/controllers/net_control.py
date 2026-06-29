from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from psycopg.types.json import Jsonb

from app.controllers.common import normalize_callsign


def net_control_state_row_to_dict(row):
    return {
        "payload": row[0] or {},
        "updatedAt": row[1].isoformat(),
    }


def normalize_net_control_status(value: Any) -> str:
    return value if value in ("member", "visitor", "unknown") else "visitor"


def normalize_net_control_traffic_type(value: Any) -> str:
    return "shortTime" if value == "shortTime" else "regular"


def normalize_net_control_station_status(value: Any) -> str:
    return value if value in ("waiting", "active", "complete", "skipped") else "waiting"


def iso_or_none(value):
    return value.isoformat() if value is not None else None


def roster_row_to_dict(row):
    return {
        "id": row[0],
        "callsign": row[1],
        "name": row[2],
        "city": row[3],
        "notes": row[4],
        "status": row[5],
        "source": row[6],
        "lat": row[7],
        "lng": row[8],
        "distanceMiles": row[9],
    }


def checkin_row_to_dict(row):
    return {
        "id": row[0],
        "callsign": row[1],
        "name": row[2],
        "location": row[3],
        "distance": row[4],
        "trafficType": row[5],
        "clubStatus": row[6],
        "visitor": row[7],
        "member": row[8],
        "memberId": row[9],
        "firstTime": row[10],
        "notes": row[11],
        "status": row[12],
        "checkInTime": row[13].isoformat(),
    }


def log_entry_row_to_dict(row):
    return {
        "id": row[0],
        "timestamp": row[1].isoformat(),
        "type": row[2],
        "message": row[3],
        "stationId": row[4],
    }


def session_row_to_dict(row):
    return {
        "id": row[0],
        "name": row[1],
        "savedAt": iso_or_none(row[2]),
        "openingScript": row[3],
        "trafficPrompt": row[4],
        "lateCheckinPrompt": row[5],
        "closingScript": row[6],
        "updatedAt": row[7].isoformat(),
    }


def fetch_net_control_roster(cur):
    cur.execute(
        """
        select
            id,
            callsign,
            name,
            city,
            notes,
            status,
            source,
            lat,
            lng,
            distance_miles
        from net_control_roster_members
        order by callsign, name
        """
    )
    return [roster_row_to_dict(row) for row in cur.fetchall()]


def fetch_net_control_checkins(cur, session_id: str):
    cur.execute(
        """
        select
            id,
            callsign,
            name,
            location,
            distance,
            traffic_type,
            club_status,
            visitor,
            member,
            member_id,
            first_time,
            notes,
            station_status,
            check_in_time
        from net_control_checkins
        where session_id = %s
        order by position, check_in_time
        """,
        (session_id,),
    )
    return [checkin_row_to_dict(row) for row in cur.fetchall()]


def fetch_net_control_queue(cur, session_id: str, station_lookup: dict[str, dict]):
    cur.execute(
        """
        select station_id
        from net_control_queue_entries
        where session_id = %s
        order by position, created_at
        """,
        (session_id,),
    )
    return [
        station_lookup[row[0]]
        for row in cur.fetchall()
        if row[0] in station_lookup
    ]


def fetch_net_control_logs(cur, session_id: str):
    cur.execute(
        """
        select
            id,
            timestamp,
            type,
            message,
            station_id
        from net_control_log_entries
        where session_id = %s
        order by position, timestamp desc
        """,
        (session_id,),
    )
    return [log_entry_row_to_dict(row) for row in cur.fetchall()]


def fetch_net_control_session_payload(cur, session_id: str):
    cur.execute(
        """
        select
            id,
            name,
            saved_at,
            opening_script,
            traffic_prompt,
            late_checkin_prompt,
            closing_script,
            updated_at
        from net_control_sessions
        where id = %s
        """,
        (session_id,),
    )
    row = cur.fetchone()
    if row is None:
        return None

    session = session_row_to_dict(row)
    stations = fetch_net_control_checkins(cur, session_id)
    station_lookup = {station["id"]: station for station in stations}

    return {
        **session,
        "stations": stations,
        "queue": fetch_net_control_queue(cur, session_id, station_lookup),
        "logEntries": fetch_net_control_logs(cur, session_id),
    }


def fetch_net_control_snapshot(cur):
    current = fetch_net_control_session_payload(cur, "current")

    if current is None:
        cur.execute(
            """
            insert into net_control_sessions (id, name, status)
            values ('current', 'Current net', 'active')
            on conflict (id) do nothing
            """
        )
        current = fetch_net_control_session_payload(cur, "current")

    cur.execute(
        """
        select id
        from net_control_sessions
        where status = 'saved'
        order by saved_at desc nulls last, updated_at desc
        """
    )
    saved_session_ids = [row[0] for row in cur.fetchall()]
    saved_sessions = [
        session
        for session_id in saved_session_ids
        if (session := fetch_net_control_session_payload(cur, session_id)) is not None
    ]

    return {
        "payload": {
            "openingScript": current["openingScript"],
            "trafficPrompt": current["trafficPrompt"],
            "lateCheckinPrompt": current["lateCheckinPrompt"],
            "closingScript": current["closingScript"],
            "stations": current["stations"],
            "queue": current["queue"],
            "logEntries": current["logEntries"],
            "savedSessions": saved_sessions,
        },
        "updatedAt": current["updatedAt"],
    }


def net_control_save_summary(payload: dict) -> str:
    stations = payload.get("stations") if isinstance(payload, dict) else []
    saved_sessions = payload.get("savedSessions") if isinstance(payload, dict) else []

    station_callsigns = [
        station.get("callsign")
        for station in stations
        if isinstance(station, dict) and station.get("callsign")
    ]

    return (
        "net-control save "
        f"stations={len(stations)} "
        f"savedSessions={len(saved_sessions)} "
        f"lastStations={station_callsigns[-3:]}"
    )


def upsert_net_control_roster_member(cur, member: dict[str, Any]):
    callsign = normalize_callsign(str(member.get("callsign") or ""))
    member_id = str(member.get("id") or f"manual-{callsign or uuid4()}").lower()

    if callsign:
        cur.execute(
            """
            select id
            from net_control_roster_members
            where callsign = %s
            """,
            (callsign,),
        )
        existing = cur.fetchone()
        if existing is not None:
            member_id = existing[0]

    cur.execute(
        """
        insert into net_control_roster_members (
            id,
            callsign,
            name,
            city,
            notes,
            status,
            source,
            lat,
            lng,
            distance_miles,
            updated_at
        )
        values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
        on conflict (id) do update set
            callsign = excluded.callsign,
            name = excluded.name,
            city = excluded.city,
            notes = excluded.notes,
            status = excluded.status,
            source = excluded.source,
            lat = excluded.lat,
            lng = excluded.lng,
            distance_miles = excluded.distance_miles,
            updated_at = now()
        returning
            id,
            callsign,
            name,
            city,
            notes,
            status,
            source,
            lat,
            lng,
            distance_miles
        """,
        (
            member_id,
            callsign,
            str(member.get("name") or "").strip(),
            member.get("city"),
            member.get("notes"),
            normalize_net_control_status(member.get("status")),
            member.get("source") if member.get("source") in ("seed", "manual") else "manual",
            member.get("lat"),
            member.get("lng"),
            member.get("distanceMiles"),
        ),
    )
    return cur.fetchone()


def mirror_net_control_state(cur, payload: dict):
    cur.execute(
        """
        insert into net_control_state (id, payload, updated_at)
        values ('current', %s, now())
        on conflict (id) do update set
            payload = excluded.payload,
            updated_at = now()
        """,
        (Jsonb(payload),),
    )


def station_to_roster_member(station: dict[str, Any]) -> dict[str, Any]:
    callsign = normalize_callsign(str(station.get("callsign") or ""))
    return {
        "id": station.get("memberId") or f"manual-{callsign or uuid4()}",
        "callsign": callsign,
        "name": str(station.get("name") or callsign).strip(),
        "city": station.get("location"),
        "notes": station.get("notes"),
        "status": normalize_net_control_status(station.get("clubStatus")),
        "source": "manual",
        "distanceMiles": station.get("distance"),
    }


def append_current_checkin(cur, station: dict[str, Any]):
    callsign = normalize_callsign(str(station.get("callsign") or ""))
    if not callsign and not str(station.get("name") or "").strip():
        raise HTTPException(status_code=400, detail="Callsign or name is required")

    cur.execute(
        """
        insert into net_control_sessions (id, name, status)
        values ('current', 'Current net', 'active')
        on conflict (id) do nothing
        """
    )

    member_row = upsert_net_control_roster_member(
        cur,
        station_to_roster_member(station),
    )

    if member_row is None:
        raise HTTPException(status_code=500, detail="Failed to upsert roster member")

    member = roster_row_to_dict(member_row)

    print(
        "roster upsert from checkin",
        {
            "input_callsign": station.get("callsign"),
            "normalized_callsign": callsign,
            "member_id": member["id"],
            "member_callsign": member["callsign"],
            "member_source": member["source"],
        },
    )

    station_id = str(station.get("id") or uuid4())
    club_status = normalize_net_control_status(station.get("clubStatus"))

    cur.execute(
        """
        select coalesce(max(position) + 1, 0)
        from net_control_checkins
        where session_id = 'current'
        """
    )
    station_position = cur.fetchone()[0]

    cur.execute(
        """
        insert into net_control_checkins (
            session_id,
            id,
            callsign,
            name,
            location,
            distance,
            traffic_type,
            club_status,
            visitor,
            member,
            member_id,
            first_time,
            notes,
            station_status,
            check_in_time,
            position,
            updated_at
        )
        values ('current', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, coalesce(%s, now()), %s, now())
        on conflict (session_id, id) do update set
            callsign = excluded.callsign,
            name = excluded.name,
            location = excluded.location,
            distance = excluded.distance,
            traffic_type = excluded.traffic_type,
            club_status = excluded.club_status,
            visitor = excluded.visitor,
            member = excluded.member,
            member_id = excluded.member_id,
            first_time = excluded.first_time,
            notes = excluded.notes,
            station_status = excluded.station_status,
            check_in_time = excluded.check_in_time,
            updated_at = now()
        """,
        (
            station_id,
            callsign,
            str(station.get("name") or "").strip(),
            station.get("location"),
            station.get("distance"),
            normalize_net_control_traffic_type(station.get("trafficType")),
            club_status,
            bool(station.get("visitor", club_status == "visitor")),
            bool(station.get("member", club_status == "member")),
            member["id"],
            bool(station.get("firstTime", club_status == "unknown")),
            station.get("notes"),
            normalize_net_control_station_status(station.get("status")),
            station.get("checkInTime"),
            station_position,
        ),
    )

    cur.execute(
        """
        select coalesce(max(position) + 1, 0)
        from net_control_queue_entries
        where session_id = 'current'
        """
    )
    queue_position = cur.fetchone()[0]

    cur.execute(
        """
        insert into net_control_queue_entries (
            session_id,
            station_id,
            position
        )
        values ('current', %s, %s)
        on conflict (session_id, station_id) do update set
            position = excluded.position
        """,
        (station_id, queue_position),
    )

    log_message = station.get("logMessage")
    if log_message:
        cur.execute(
            """
            insert into net_control_log_entries (
                session_id,
                id,
                timestamp,
                type,
                message,
                station_id,
                position
            )
            values ('current', %s, now(), 'checkin', %s, %s, 0)
            """,
            (str(uuid4()), log_message, station_id),
        )

    cur.execute(
        """
        update net_control_sessions
        set updated_at = now()
        where id = 'current'
        """
    )

    print(
        f"net-control checkin add callsign={member['callsign']} "
        f"rosterId={member['id']} stationId={station_id}"
    )

    return member


def upsert_net_control_session(cur, session_id: str, session: dict, status: str):
    cur.execute(
        """
        insert into net_control_sessions (
            id,
            name,
            status,
            opening_script,
            traffic_prompt,
            late_checkin_prompt,
            closing_script,
            saved_at,
            updated_at
        )
        values (%s, %s, %s, %s, %s, %s, %s, %s, now())
        on conflict (id) do update set
            name = excluded.name,
            status = excluded.status,
            opening_script = excluded.opening_script,
            traffic_prompt = excluded.traffic_prompt,
            late_checkin_prompt = excluded.late_checkin_prompt,
            closing_script = excluded.closing_script,
            saved_at = excluded.saved_at,
            updated_at = now()
        """,
        (
            session_id,
            str(session.get("name") or ("Current net" if status == "active" else "Saved net")),
            status,
            str(session.get("openingScript") or ""),
            str(session.get("trafficPrompt") or ""),
            str(session.get("lateCheckinPrompt") or ""),
            str(session.get("closingScript") or ""),
            session.get("savedAt"),
        ),
    )


def replace_net_control_session_children(cur, session_id: str, session: dict):
    cur.execute("delete from net_control_queue_entries where session_id = %s", (session_id,))
    cur.execute("delete from net_control_log_entries where session_id = %s", (session_id,))
    cur.execute("delete from net_control_checkins where session_id = %s", (session_id,))

    stations = session.get("stations") if isinstance(session.get("stations"), list) else []
    for index, station in enumerate(stations):
        if not isinstance(station, dict):
            continue

        station_id = str(station.get("id") or uuid4())
        club_status = normalize_net_control_status(station.get("clubStatus"))
        cur.execute(
            """
            insert into net_control_checkins (
                session_id,
                id,
                callsign,
                name,
                location,
                distance,
                traffic_type,
                club_status,
                visitor,
                member,
                member_id,
                first_time,
                notes,
                station_status,
                check_in_time,
                position,
                updated_at
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, coalesce(%s, now()), %s, now())
            """,
            (
                session_id,
                station_id,
                normalize_callsign(str(station.get("callsign") or "")),
                str(station.get("name") or "").strip(),
                station.get("location"),
                station.get("distance"),
                normalize_net_control_traffic_type(station.get("trafficType")),
                club_status,
                bool(station.get("visitor", club_status == "visitor")),
                bool(station.get("member", club_status == "member")),
                station.get("memberId"),
                bool(station.get("firstTime", club_status == "unknown")),
                station.get("notes"),
                normalize_net_control_station_status(station.get("status")),
                station.get("checkInTime"),
                index,
            ),
        )

    queue = session.get("queue") if isinstance(session.get("queue"), list) else []
    for index, station in enumerate(queue):
        if not isinstance(station, dict) or not station.get("id"):
            continue

        cur.execute(
            """
            insert into net_control_queue_entries (
                session_id,
                station_id,
                position
            )
            values (%s, %s, %s)
            on conflict (session_id, station_id) do update set
                position = excluded.position
            """,
            (session_id, str(station["id"]), index),
        )

    log_entries = session.get("logEntries") if isinstance(session.get("logEntries"), list) else []
    for index, entry in enumerate(log_entries):
        if not isinstance(entry, dict):
            continue

        cur.execute(
            """
            insert into net_control_log_entries (
                session_id,
                id,
                timestamp,
                type,
                message,
                station_id,
                position
            )
            values (%s, %s, coalesce(%s, now()), %s, %s, %s, %s)
            """,
            (
                session_id,
                str(entry.get("id") or uuid4()),
                entry.get("timestamp"),
                str(entry.get("type") or "info"),
                str(entry.get("message") or ""),
                entry.get("stationId"),
                index,
            ),
        )


def save_net_control_snapshot(cur, payload: dict):
    if not isinstance(payload, dict):
        return

    upsert_net_control_session(cur, "current", payload, "active")
    replace_net_control_session_children(cur, "current", payload)

    if "savedSessions" not in payload:
        return

    saved_sessions = payload.get("savedSessions") if isinstance(payload.get("savedSessions"), list) else []
    saved_ids = []

    for session in saved_sessions:
        if not isinstance(session, dict):
            continue

        session_id = str(session.get("id") or uuid4())
        saved_ids.append(session_id)
        upsert_net_control_session(cur, session_id, {**payload, **session}, "saved")
        replace_net_control_session_children(cur, session_id, session)

    if saved_ids:
        cur.execute(
            """
            delete from net_control_sessions
            where status = 'saved'
              and not (id = any(%s))
            """,
            (saved_ids,),
        )
    else:
        cur.execute("delete from net_control_sessions where status = 'saved'")
