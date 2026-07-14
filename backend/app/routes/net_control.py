from fastapi import APIRouter, HTTPException, Response

from app.controllers.net_control import (
    append_current_checkin,
    fetch_net_control_roster,
    fetch_net_control_snapshot,
    mirror_net_control_state,
    net_control_save_summary,
    roster_row_to_dict,
    upsert_net_control_roster_member,
    save_net_control_snapshot,
)
from app.db import get_connection
from app.models.net_control import (
    NetControlCheckInCreate,
    NetControlRosterMemberUpsert,
    NetControlSessionUpsert,
    NetControlStateUpsert,
)


router = APIRouter()


@router.get("/net-control/state")
def get_net_control_state():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                return fetch_net_control_snapshot(cur)

    except HTTPException:
        raise
    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to load net control state",
        ) from exc


@router.put("/net-control/state")
def put_net_control_state(state: NetControlStateUpsert):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                print(net_control_save_summary(state.payload))
                save_net_control_snapshot(cur, state.payload)
                snapshot = fetch_net_control_snapshot(cur)
                mirror_net_control_state(cur, snapshot["payload"])

        return snapshot

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to save net control state",
        ) from exc


@router.get("/net-control/session")
def get_net_control_session(updated_after: str | None = None):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                if updated_after:
                    cur.execute(
                        """
                        select updated_at
                        from net_control_sessions
                        where id = 'current'
                        """
                    )
                    row = cur.fetchone()
                    if row is not None and row[0].isoformat() == updated_after:
                        return Response(status_code=204)

                return fetch_net_control_snapshot(cur)

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to load net control session",
        ) from exc


@router.put("/net-control/session")
def put_net_control_session(session: NetControlSessionUpsert):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                print(net_control_save_summary(session.payload))
                save_net_control_snapshot(cur, session.payload)
                snapshot = fetch_net_control_snapshot(cur)
                mirror_net_control_state(cur, snapshot["payload"])
                return snapshot

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to save net control session",
        ) from exc


@router.post("/net-control/checkins", status_code=201)
def create_net_control_checkin(station: NetControlCheckInCreate):
    try:
        station_payload = station.model_dump()
        with get_connection() as conn:
            with conn.cursor() as cur:
                member = append_current_checkin(cur, station_payload)
                snapshot = fetch_net_control_snapshot(cur)
                mirror_net_control_state(cur, snapshot["payload"])
                snapshot["savedRosterMember"] = member
                return snapshot

    except HTTPException:
        raise
    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to add net control check-in",
        ) from exc


@router.get("/net-control/roster-members")
def list_net_control_roster_members():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                roster = fetch_net_control_roster(cur)
        return roster

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to load roster members",
        ) from exc


@router.put("/net-control/roster-members/{member_id}")
def put_net_control_roster_member(
    member_id: str,
    member: NetControlRosterMemberUpsert,
):
    try:
        normalized_member = {
            "id": member_id or member.id,
            "callsign": member.callsign,
            "name": member.name,
            "city": member.city,
            "notes": member.notes,
            "status": member.status,
            "source": member.source,
            "lat": member.lat,
            "lng": member.lng,
            "distanceMiles": member.distanceMiles,
        }

        with get_connection() as conn:
            with conn.cursor() as cur:
                row = upsert_net_control_roster_member(cur, normalized_member)

        if row is None:
            raise HTTPException(status_code=404, detail="Roster member not found")

        print(f"net-control roster upsert id={row[0]} callsign={row[1]}")
        return roster_row_to_dict(row)

    except HTTPException:
        raise
    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to save roster member",
        ) from exc


@router.delete("/net-control/roster-members/{member_id}")
def delete_net_control_roster_member(member_id: str):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select callsign
                    from net_control_roster_members
                    where id = %s
                    """,
                    (member_id,),
                )
                row = cur.fetchone()
                callsign = row[0] if row else None

                if callsign:
                    cur.execute(
                        """
                        delete from net_control_queue_entries qe
                        using net_control_checkins c
                        where qe.session_id = c.session_id
                          and qe.station_id = c.id
                          and c.session_id = 'current'
                          and (c.member_id = %s or c.callsign = %s)
                        """,
                        (member_id, callsign),
                    )
                    cur.execute(
                        """
                        delete from net_control_checkins
                        where session_id = 'current'
                          and (member_id = %s or callsign = %s)
                        """,
                        (member_id, callsign),
                    )

                cur.execute(
                    """
                    delete from net_control_roster_members
                    where id = %s
                    """,
                    (member_id,),
                )
                deleted = cur.rowcount

                cur.execute(
                    """
                    update net_control_sessions
                    set updated_at = now()
                    where id = 'current'
                    """
                )
                snapshot = fetch_net_control_snapshot(cur)
                mirror_net_control_state(cur, snapshot["payload"])

        print(f"net-control roster delete id={member_id} callsign={callsign} deleted={deleted}")

        return snapshot

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to delete roster member",
        ) from exc
