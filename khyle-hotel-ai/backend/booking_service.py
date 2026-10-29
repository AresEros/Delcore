import sqlite3
from datetime import datetime
from uuid import uuid4

DATABASE = "bookings.db"


def get_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def generate_booking_reference():
    date_part = datetime.now().strftime("%Y%m%d")
    unique_part = uuid4().hex[:6].upper()

    return f"KGH-{date_part}-{unique_part}"



def room_is_available(
    room_name,
    check_in,
    check_out,
    exclude_booking_reference=None
):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id
        FROM bookings
        WHERE room_name = ?
        AND status IN ('pending', 'confirmed')
        AND check_in < ?
        AND check_out > ?
        AND (
            ? IS NULL
            OR booking_reference != ?
        )
        """,
        (
            room_name,
            check_out,
            check_in,
            exclude_booking_reference,
            exclude_booking_reference
        )
    )

    booking = cursor.fetchone()
    connection.close()

    return booking is None


def create_booking(
    guest_name,
    room_name,
    check_in,
    check_out,
    guests,
    rate_per_night
):
    if not room_is_available(room_name, check_in, check_out):
        return {
            "success": False,
            "message": "This room is not available for the selected dates."
        }

    booking_reference = generate_booking_reference()

    created_at = datetime.now().isoformat(timespec="seconds")

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO bookings (
            booking_reference,
            guest_name,
            room_name,
            check_in,
            check_out,
            guests,
            rate_per_night,
            status,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            booking_reference,
            guest_name,
            room_name,
            check_in,
            check_out,
            guests,
            rate_per_night,
            "pending",
            created_at
        )
    )

    connection.commit()

    connection.close()

    return {
        "success": True,
        "booking_reference": booking_reference,
        "guest_name": guest_name,
        "room_name": room_name,
        "check_in": check_in,
        "check_out": check_out,
        "guests": guests,
        "rate_per_night": rate_per_night,
        "status": "pending",
        "created_at": created_at
    }


def get_booking(booking_reference):
    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM bookings
        WHERE booking_reference = ?
        """,
        (booking_reference,)
    )

    booking = cursor.fetchone()

    connection.close()

    if booking is None:
        return None

    return dict(booking)

