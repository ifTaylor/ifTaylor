def normalize_callsign(callsign: str) -> str:
    return "".join(
        character
        for character in callsign.strip().upper()
        if character.isalnum() or character == "/"
    )[:16]
