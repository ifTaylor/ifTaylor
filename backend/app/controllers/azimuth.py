from uuid import UUID


def uuid_list_to_strings(value) -> list[str]:
    if value is None:
        return []

    return [str(item) for item in value if item is not None]


def row_to_dict(row):
    report_id = str(row[10]) if row[10] else None
    report_ids = uuid_list_to_strings(row[12])

    if report_id and report_id not in report_ids:
        report_ids.insert(0, report_id)

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
        "reportId": report_id,
        "reportIds": report_ids,
        "sourcePointId": str(row[11]) if row[11] else None,
    }


def point_row_to_dict(row):
    report_id = str(row[6]) if row[6] else None
    report_ids = uuid_list_to_strings(row[7])

    if report_id and report_id not in report_ids:
        report_ids.insert(0, report_id)

    return {
        "id": str(row[0]),
        "label": row[1],
        "lat": row[2],
        "lng": row[3],
        "createdBy": row[4],
        "createdAt": row[5].isoformat(),
        "reportId": report_id,
        "reportIds": report_ids,
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



def fetch_azimuth_line(cur, line_id: UUID):
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
        where al.id = %s
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
        """,
        (line_id,),
    )
    return cur.fetchone()


def fetch_report_point(cur, point_id: UUID):
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
        where rp.id = %s
        group by
            rp.id,
            rp.label,
            rp.lat,
            rp.lng,
            rp.created_by,
            rp.created_at,
            rp.report_id
        """,
        (point_id,),
    )
    return cur.fetchone()
