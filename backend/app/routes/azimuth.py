from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.controllers.azimuth import (
    fetch_azimuth_line,
    fetch_report_point,
    point_row_to_dict,
    report_row_to_dict,
    row_to_dict,
)
from app.db import get_connection
from app.models.azimuth import (
    AzimuthLineCreate,
    AzimuthLineUpdate,
    AzimuthReportUpdate,
    PointReportUpdate,
    ReportPointCreate,
    ReportPointUpdate,
    SightingReportCreate,
)


router = APIRouter()


@router.get("/sighting-reports")
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


@router.post("/sighting-reports", status_code=201)
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


@router.delete("/sighting-reports/{report_id}", status_code=204)
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


@router.get("/report-points")
def list_report_points():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select
                        rp.id,
                        rp.label,
                        rp.lat,
                        rp.lng,
                        rp.created_by,
                        rp.created_at,
                        rp.report_id,
                        coalesce(
                            array_remove(array_agg(pr.report_id order by pr.created_at), null),
                            '{}'::uuid[]
                        ) as report_ids
                    from report_points rp
                    left join point_reports pr
                        on pr.point_id = rp.id
                    group by
                        rp.id,
                        rp.label,
                        rp.lat,
                        rp.lng,
                        rp.created_by,
                        rp.created_at,
                        rp.report_id
                    order by rp.created_at desc
                    """
                )
                rows = cur.fetchall()

        return [point_row_to_dict(row) for row in rows]

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to load report points",
        ) from exc


@router.post("/report-points", status_code=201)
def create_report_point(point: ReportPointCreate):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    insert into report_points (
                        label,
                        lat,
                        lng,
                        created_by,
                        report_id
                    )
                    values (%s, %s, %s, %s, %s)
                    returning id
                    """,
                    (
                        point.label,
                        point.lat,
                        point.lng,
                        point.createdBy,
                        point.reportId,
                    ),
                )
                point_id = cur.fetchone()[0]

                if point.reportId is not None:
                    cur.execute(
                        """
                        insert into point_reports (
                            point_id,
                            report_id
                        )
                        values (%s, %s)
                        on conflict (point_id, report_id) do nothing
                        """,
                        (point_id, point.reportId),
                    )

                row = fetch_report_point(cur, point_id)

        return point_row_to_dict(row)

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to save report point",
        ) from exc


@router.patch("/report-points/{point_id}")
def update_report_point(point_id: UUID, update: ReportPointUpdate):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    update report_points
                    set
                        label = coalesce(%s, label),
                        lat = coalesce(%s, lat),
                        lng = coalesce(%s, lng)
                    where id = %s
                    """,
                    (
                        update.label,
                        update.lat,
                        update.lng,
                        point_id,
                    ),
                )

                row = fetch_report_point(cur, point_id)

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Report point not found",
            )

        return point_row_to_dict(row)

    except HTTPException:
        raise

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to update report point",
        ) from exc


@router.post("/report-points/{point_id}/reports/{report_id}")
def add_report_to_point(point_id: UUID, report_id: UUID):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = fetch_report_point(cur, point_id)

                if row is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Report point not found",
                    )

                cur.execute(
                    "select id from sighting_reports where id = %s",
                    (report_id,),
                )

                if cur.fetchone() is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Report not found",
                    )

                cur.execute(
                    """
                    insert into point_reports (
                        point_id,
                        report_id
                    )
                    values (%s, %s)
                    on conflict (point_id, report_id) do nothing
                    """,
                    (point_id, report_id),
                )

                cur.execute(
                    """
                    update report_points
                    set report_id = coalesce(report_id, %s)
                    where id = %s
                    """,
                    (report_id, point_id),
                )

                row = fetch_report_point(cur, point_id)

        return point_row_to_dict(row)

    except HTTPException:
        raise

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to add point report link",
        ) from exc


@router.delete("/report-points/{point_id}/reports/{report_id}")
def remove_report_from_point(point_id: UUID, report_id: UUID):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = fetch_report_point(cur, point_id)

                if row is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Report point not found",
                    )

                cur.execute(
                    """
                    delete from point_reports
                    where point_id = %s
                      and report_id = %s
                    """,
                    (point_id, report_id),
                )

                cur.execute(
                    """
                    update report_points
                    set report_id = null
                    where id = %s
                      and report_id = %s
                    """,
                    (point_id, report_id),
                )

                cur.execute(
                    """
                    update report_points rp
                    set report_id = (
                        select pr.report_id
                        from point_reports pr
                        where pr.point_id = rp.id
                        order by pr.created_at
                        limit 1
                    )
                    where rp.id = %s
                      and rp.report_id is null
                    """,
                    (point_id,),
                )

                row = fetch_report_point(cur, point_id)

        return point_row_to_dict(row)

    except HTTPException:
        raise

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to remove point report link",
        ) from exc


@router.patch("/report-points/{point_id}/report")
def update_report_point_report(point_id: UUID, update: PointReportUpdate):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = fetch_report_point(cur, point_id)

                if row is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Report point not found",
                    )

                cur.execute(
                    "delete from point_reports where point_id = %s",
                    (point_id,),
                )

                if update.reportId is not None:
                    cur.execute(
                        """
                        insert into point_reports (
                            point_id,
                            report_id
                        )
                        values (%s, %s)
                        on conflict (point_id, report_id) do nothing
                        """,
                        (point_id, update.reportId),
                    )

                cur.execute(
                    """
                    update report_points
                    set report_id = %s
                    where id = %s
                    """,
                    (update.reportId, point_id),
                )

                row = fetch_report_point(cur, point_id)

        return point_row_to_dict(row)

    except HTTPException:
        raise

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to update point report link",
        ) from exc


@router.delete("/report-points/{point_id}", status_code=204)
def delete_report_point(point_id: UUID):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "delete from report_points where id = %s",
                    (point_id,),
                )

        return None

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to delete report point",
        ) from exc


@router.get("/azimuth-lines")
def list_azimuth_lines():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select
                        al.id,
                        al.label,
                        al.from_lat,
                        al.from_lng,
                        al.to_lat,
                        al.to_lng,
                        al.bearing_deg,
                        al.distance_miles,
                        al.created_by,
                        al.created_at,
                        al.report_id,
                        al.source_point_id,
                        coalesce(
                            array_remove(array_agg(alr.report_id order by alr.created_at), null),
                            '{}'::uuid[]
                        ) as report_ids
                    from azimuth_lines al
                    left join azimuth_line_reports alr
                        on alr.azimuth_line_id = al.id
                    group by
                        al.id,
                        al.label,
                        al.from_lat,
                        al.from_lng,
                        al.to_lat,
                        al.to_lng,
                        al.bearing_deg,
                        al.distance_miles,
                        al.created_by,
                        al.created_at,
                        al.report_id,
                        al.source_point_id
                    order by al.created_at desc
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


@router.post("/azimuth-lines", status_code=201)
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
                        report_id,
                        source_point_id
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    returning id
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
                        line.sourcePointId,
                    ),
                )
                line_id = cur.fetchone()[0]

                if line.reportId is not None:
                    cur.execute(
                        """
                        insert into azimuth_line_reports (
                            azimuth_line_id,
                            report_id
                        )
                        values (%s, %s)
                        on conflict (azimuth_line_id, report_id) do nothing
                        """,
                        (line_id, line.reportId),
                    )

                row = fetch_azimuth_line(cur, line_id)

        return row_to_dict(row)

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to save azimuth line",
        ) from exc


@router.patch("/azimuth-lines/{line_id}")
def update_azimuth_line(line_id: UUID, update: AzimuthLineUpdate):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    update azimuth_lines
                    set
                        label = coalesce(%s, label),
                        to_lat = coalesce(%s, to_lat),
                        to_lng = coalesce(%s, to_lng),
                        bearing_deg = coalesce(%s, bearing_deg),
                        distance_miles = coalesce(%s, distance_miles),
                        source_point_id = coalesce(%s, source_point_id)
                    where id = %s
                    """,
                    (
                        update.label,
                        update.toLat,
                        update.toLng,
                        update.bearingDeg,
                        update.distanceMiles,
                        update.sourcePointId,
                        line_id,
                    ),
                )

                row = fetch_azimuth_line(cur, line_id)

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
            detail="Failed to update azimuth line",
        ) from exc


@router.post("/azimuth-lines/{line_id}/reports/{report_id}")
def add_report_to_azimuth_line(line_id: UUID, report_id: UUID):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = fetch_azimuth_line(cur, line_id)

                if row is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Azimuth line not found",
                    )

                cur.execute(
                    "select id from sighting_reports where id = %s",
                    (report_id,),
                )

                if cur.fetchone() is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Report not found",
                    )

                cur.execute(
                    """
                    insert into azimuth_line_reports (
                        azimuth_line_id,
                        report_id
                    )
                    values (%s, %s)
                    on conflict (azimuth_line_id, report_id) do nothing
                    """,
                    (line_id, report_id),
                )

                cur.execute(
                    """
                    update azimuth_lines
                    set report_id = coalesce(report_id, %s)
                    where id = %s
                    """,
                    (report_id, line_id),
                )

                row = fetch_azimuth_line(cur, line_id)

        return row_to_dict(row)

    except HTTPException:
        raise

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to add azimuth report link",
        ) from exc


@router.delete("/azimuth-lines/{line_id}/reports/{report_id}")
def remove_report_from_azimuth_line(line_id: UUID, report_id: UUID):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = fetch_azimuth_line(cur, line_id)

                if row is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Azimuth line not found",
                    )

                cur.execute(
                    """
                    delete from azimuth_line_reports
                    where azimuth_line_id = %s
                      and report_id = %s
                    """,
                    (line_id, report_id),
                )

                cur.execute(
                    """
                    update azimuth_lines
                    set report_id = null
                    where id = %s
                      and report_id = %s
                    """,
                    (line_id, report_id),
                )

                cur.execute(
                    """
                    update azimuth_lines al
                    set report_id = (
                        select alr.report_id
                        from azimuth_line_reports alr
                        where alr.azimuth_line_id = al.id
                        order by alr.created_at
                        limit 1
                    )
                    where al.id = %s
                      and al.report_id is null
                    """,
                    (line_id,),
                )

                row = fetch_azimuth_line(cur, line_id)

        return row_to_dict(row)

    except HTTPException:
        raise

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to remove azimuth report link",
        ) from exc


@router.patch("/azimuth-lines/{line_id}/report")
def update_azimuth_line_report(line_id: UUID, update: AzimuthReportUpdate):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = fetch_azimuth_line(cur, line_id)

                if row is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Azimuth line not found",
                    )

                cur.execute(
                    "delete from azimuth_line_reports where azimuth_line_id = %s",
                    (line_id,),
                )

                if update.reportId is not None:
                    cur.execute(
                        """
                        insert into azimuth_line_reports (
                            azimuth_line_id,
                            report_id
                        )
                        values (%s, %s)
                        on conflict (azimuth_line_id, report_id) do nothing
                        """,
                        (line_id, update.reportId),
                    )

                cur.execute(
                    """
                    update azimuth_lines
                    set report_id = %s
                    where id = %s
                    """,
                    (update.reportId, line_id),
                )

                row = fetch_azimuth_line(cur, line_id)

        return row_to_dict(row)

    except HTTPException:
        raise

    except Exception as exc:
        print(exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to update azimuth report link",
        ) from exc


@router.delete("/azimuth-lines/{line_id}", status_code=204)
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
