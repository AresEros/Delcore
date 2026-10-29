
import re
import os
from datetime import datetime
import sqlite3
from pathlib import Path


import secrets

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.responses import FileResponse
from pydantic import BaseModel

from hotel_data import (
    hotel,
    rooms,
    facilities,
    restaurant,
    spa,
    airport_transfer,
    policies,
)

from booking_service import (
    create_booking,
    get_booking,
    room_is_available,
)

from conversation_service import (
    get_conversation,
    update_conversation,
)

load_dotenv(Path(__file__).resolve().parent / ".env")

app = FastAPI(title="Khyle Hotel AI")



security = HTTPBasic()


def require_admin(
    credentials: HTTPBasicCredentials = Depends(security)
):
    expected_username = os.getenv("ADMIN_USERNAME")
    expected_password = os.getenv("ADMIN_PASSWORD")

    if not expected_username or not expected_password:
        raise HTTPException(
            status_code=500,
            detail="Admin credentials are not configured."
        )

    username_ok = secrets.compare_digest(
        credentials.username,
        expected_username
    )

    password_ok = secrets.compare_digest(
        credentials.password,
        expected_password
    )

    if not (username_ok and password_ok):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials.",
            headers={"WWW-Authenticate": "Basic"}
        )

    return credentials.username


# ============================================================
# BOOKING REQUEST MODEL
# ============================================================

class BookingRequest(BaseModel):
    guest_name: str
    room_name: str
    check_in: str
    check_out: str
    guests: int


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def get_dates(question):
    return re.findall(r"\b\d{4}-\d{2}-\d{2}\b", question)


def get_guest_count(question):
    question_lower = question.lower()

    word_numbers = {
        "one": 1,
        "two": 2,
        "three": 3,
        "four": 4,
    }

    for word, number in word_numbers.items():
        if re.search(
            rf"\b{word}\s+(?:guest|guests|person|people)\b",
            question_lower,
        ):
            return number

    match = re.search(
        r"\b(\d+)\s*(?:guest|guests|person|people)\b",
        question_lower,
    )

    if match:
        return int(match.group(1))

    return None


def find_room(question):
    question_lower = question.lower()

    for room in rooms:
        if room["name"].lower() in question_lower:
            return room

    return None


def format_booking(booking):
    return (
        f"<strong>Booking Details</strong><br><br>"
        f"<strong>Booking Reference:</strong> "
        f"{booking['booking_reference']}<br>"
        f"<strong>Guest:</strong> {booking['guest_name']}<br>"
        f"<strong>Room:</strong> {booking['room_name']}<br>"
        f"<strong>Check-in:</strong> {booking['check_in']}<br>"
        f"<strong>Check-out:</strong> {booking['check_out']}<br>"
        f"<strong>Guests:</strong> {booking['guests']}<br>"
        f"<strong>Rate per night:</strong> "
        f"{booking['rate_per_night']:,} NGN<br>"
        f"<strong>Status:</strong> {booking['status']}"
    )


def validate_dates(check_in, check_out):
    try:
        check_in_date = datetime.strptime(
            check_in, "%Y-%m-%d"
        ).date()

        check_out_date = datetime.strptime(
            check_out, "%Y-%m-%d"
        ).date()

    except ValueError:
        return None, None, (
            "The dates provided are not valid. "
            "Please use the format YYYY-MM-DD."
        )

    if check_out_date <= check_in_date:
        return None, None, (
            "Your check-out date must be after your check-in date."
        )

    return check_in_date, check_out_date, None


# ============================================================
# HOME AND HOTEL INFORMATION
# ============================================================

@app.get("/")
def home():
    return {
        "message": "Welcome to Khyle Hotel AI Concierge",
        "status": "online",
    }


@app.get("/hotel")
def hotel_information():
    return {"hotel": hotel}


@app.get("/hotel/rooms")
def hotel_rooms():
    return {"rooms": rooms}


@app.get("/hotel/facilities")
def hotel_facilities():
    return {"facilities": facilities}


@app.get("/hotel/policies")
def hotel_policies():
    return {"policies": policies}


# ============================================================
# HOTEL CONCIERGE CHAT LOGIC
# ============================================================

@app.get("/ask")
def ask_ai(question: str, session_id: str = "default"):

    question_lower = question.lower().strip()
    conversation = get_conversation(session_id)

    # --------------------------------------------------------
    # 1. REMEMBER GUEST NAME
    # --------------------------------------------------------

    name_match = re.search(
        r"(?:my name is|i am|i'm|name is)\s+"
        r"([A-Za-z]+(?:\s+[A-Za-z]+){0,3})",
        question,
        re.IGNORECASE,
    )

    if name_match:
        guest_name = name_match.group(1).strip()
        update_conversation(
            session_id,
            {"guest_name": guest_name},
        )
        conversation = get_conversation(session_id)

    # --------------------------------------------------------
    # 2. CHECK BOOKING REFERENCE
    # --------------------------------------------------------

    booking_match = re.search(
        r"\bKGH-\d{8}-[A-Z0-9]{6}\b",
        question.upper(),
    )

    if booking_match:
        booking_reference = booking_match.group(0)
        booking = get_booking(booking_reference)

        if booking:
            return {
                "question": question,
                "answer": format_booking(booking),
            }

        return {
            "question": question,
            "answer": (
                f"I could not find a booking with reference "
                f"<strong>{booking_reference}</strong>. "
                "Please check the reference and try again."
            ),
        }

    # --------------------------------------------------------
    # 3. REMEMBER ROOM, DATES AND GUEST COUNT
    # --------------------------------------------------------

    selected_room = find_room(question)

    if selected_room:
        update_conversation(
            session_id,
            {"room_name": selected_room["name"]},
        )

    dates = get_dates(question)

    if len(dates) >= 2:
        update_conversation(
            session_id,
            {
                "check_in": dates[0],
                "check_out": dates[1],
            },
        )

    guest_count = get_guest_count(question)

    if guest_count is not None:
        update_conversation(
            session_id,
            {"guests": guest_count},
        )

    conversation = get_conversation(session_id)

    # --------------------------------------------------------
    # 4. DETECT BOOKING INTENT BEFORE GENERAL ROOM QUESTIONS
    # --------------------------------------------------------

    booking_words = (
        "book",
        "booking",
        "reserve",
        "reservation",
    )

    has_booking_word = any(
        word in question_lower
        for word in booking_words
    )

    has_date_range = len(dates) >= 2

    if has_booking_word and has_date_range:
        intent = "availability"
    else:
        intent = None

        intents = {
            "availability": [
                "available",
                "availability",
                "vacancy",
                "vacant",
                "free room",
                "free rooms",
            ],
            "check_in": [
                "check in",
                "check-in",
                "arrival time",
                "arrive",
                "arrival",
            ],
            "check_out": [
                "check out",
                "check-out",
                "departure time",
                "depart",
                "departure",
            ],
            "rooms": [
                "room",
                "rooms",
                "suite",
                "suites",
                "accommodation",
                "stay",
            ],
            "facilities": [
                "facility",
                "facilities",
                "amenities",
                "amenity",
            ],
            "restaurant": [
                "restaurant",
                "breakfast",
                "lunch",
                "dinner",
                "food",
                "meal",
                "eat",
                "eating",
                "menu",
            ],
            "spa": [
                "spa",
                "massage",
                "facial",
                "body treatment",
                "wellness",
            ],
            "airport_transfer": [
                "airport",
                "airport transfer",
                "airport shuttle",
            ],
            "cancellation": [
                "cancel",
                "cancellation",
            ],
            "smoking": [
                "smoking",
                "smoke",
            ],
        }

        for possible_intent, keywords in intents.items():
            if any(
                keyword in question_lower
                for keyword in keywords
            ):
                intent = possible_intent
                break

    # --------------------------------------------------------
    # 5. HANDLE ROOM AVAILABILITY
    # --------------------------------------------------------

    if intent == "availability":

        if len(dates) < 2:
            return {
                "question": question,
                "answer": (
                    "I can check room availability for you. "
                    "Please provide the check-in and check-out "
                    "dates in YYYY-MM-DD format. "
                    "For example: 2026-10-15 to 2026-10-17."
                ),
            }

        check_in = dates[0]
        check_out = dates[1]

        check_in_date, check_out_date, date_error = (
            validate_dates(check_in, check_out)
        )

        if date_error:
            return {
                "question": question,
                "answer": date_error,
            }

        guests = guest_count

        if guests is None:
            guests = conversation.get("guests")

        requested_room = find_room(question)

        if requested_room is None:
            requested_room_name = conversation.get("room_name")

            if requested_room_name:
                requested_room = next(
                    (
                        room for room in rooms
                        if room["name"].lower()
                        == requested_room_name.lower()
                    ),
                    None,
                )

        if requested_room is not None:

            if guests is not None and guests < 1:
                return {
                    "question": question,
                    "answer": "The number of guests must be at least 1.",
                }

            if (
                guests is not None
                and guests > requested_room["capacity"]
            ):
                return {
                    "question": question,
                    "answer": (
                        f"<strong>{requested_room['name']} cannot "
                        f"accommodate {guests} guests.</strong><br><br>"
                        f"Maximum capacity: "
                        f"{requested_room['capacity']} guests."
                    ),
                }

            available = room_is_available(
                requested_room["name"],
                check_in,
                check_out,
            )

            if not available:
                update_conversation(
                    session_id,
                    {"pending_booking": None},
                )

                return {
                    "question": question,
                    "answer": (
                        f"<strong>{requested_room['name']} is not "
                        f"available</strong> for {check_in} to "
                        f"{check_out}. Please choose different "
                        "dates or another room."
                    ),
                }

            # Save the proposed booking for the confirmation step.
            update_conversation(
                session_id,
                {
                    "room_name": requested_room["name"],
                    "check_in": check_in,
                    "check_out": check_out,
                    "guests": guests,
                    "pending_booking": {
                        "room_name": requested_room["name"],
                        "check_in": check_in,
                        "check_out": check_out,
                        "guests": guests,
                    },
                },
            )

            nights = (check_out_date - check_in_date).days
            total = nights * requested_room["rate_per_night"]

            return {
                "question": question,
                "answer": (
                    f"<strong>{requested_room['name']} is available.</strong>"
                    f"<br><br>"
                    f"Check-in: {check_in}<br>"
                    f"Check-out: {check_out}<br>"
                    f"Guests: {guests if guests is not None else 'Not specified'}"
                    f"<br>"
                    f"Rate: {requested_room['currency']} "
                    f"{requested_room['rate_per_night']:,} per night<br>"
                    f"Nights: {nights}<br>"
                    f"Estimated total: {requested_room['currency']} "
                    f"{total:,}<br><br>"
                    "Would you like to proceed with this booking? "
                    "Please reply <strong>Yes, book it</strong> "
                    "or <strong>No</strong>."
                ),
            }

        # No specific room selected: list available rooms.
        available_rooms = []

        for room in rooms:

            if guests is not None and guests > room["capacity"]:
                continue

            if room_is_available(
                room["name"],
                check_in,
                check_out,
            ):
                available_rooms.append(
                    {
                        "name": room["name"],
                        "description": room["description"],
                        "rate_per_night": room["rate_per_night"],
                        "currency": room["currency"],
                        "capacity": room["capacity"],
                    }
                )

        if available_rooms:
            return {
                "question": question,
                "answer": available_rooms,
            }

        return {
            "question": question,
            "answer": (
                f"No rooms are available for the requested dates "
                f"{check_in} to {check_out}. "
                "Please try different dates."
            ),
        }

    # --------------------------------------------------------
    # 6. CONFIRM OR CANCEL A PROPOSED BOOKING
    # --------------------------------------------------------

    yes_phrases = [
        "yes",
        "yes please",
        "yes book it",
        "yes, book it",
        "yes i want to book it",
        "yes, i want to book it",
        "i want to book it",
        "proceed",
        "confirm booking",
        "confirm the booking",
        "go ahead",
        "book it",
    ]

    no_phrases = [
        "no",
        "no thanks",
        "cancel that",
        "don't book",
        "do not book",
        "not now",
    ]

    is_yes = question_lower in yes_phrases
    is_no = question_lower in no_phrases

    pending_booking = conversation.get("pending_booking")

    if is_no and pending_booking:
        update_conversation(
            session_id,
            {"pending_booking": None},
        )

        return {
            "question": question,
            "answer": (
                "No problem. I have not created the booking. "
                "You can request another room or different dates "
                "whenever you are ready."
            ),
        }

    if is_yes and pending_booking:

        guest_name = conversation.get("guest_name")
        room_name = pending_booking["room_name"]
        check_in = pending_booking["check_in"]
        check_out = pending_booking["check_out"]
        guests = pending_booking["guests"]

        if not guest_name:
            return {
                "question": question,
                "answer": (
                    "Before I create the booking, please provide "
                    "the guest's full name. For example: "
                    "'My name is Adeshina Adewunmi.'"
                ),
            }

        if guests is None:
            return {
                "question": question,
                "answer": (
                    "Before I create the booking, please tell me "
                    "how many guests will be staying."
                ),
            }

        if guests < 1:
            return {
                "question": question,
                "answer": (
                    "The number of guests must be at least 1. "
                    "Please provide a valid guest count."
                ),
            }

        room = next(
            (
                item for item in rooms
                if item["name"].lower() == room_name.lower()
            ),
            None,
        )

        if room is None:
            update_conversation(
                session_id,
                {"pending_booking": None},
            )

            return {
                "question": question,
                "answer": (
                    "I could not identify the selected room. "
                    "Please start a new room request."
                ),
            }

        if guests > room["capacity"]:
            return {
                "question": question,
                "answer": (
                    f"{room_name} accommodates up to "
                    f"{room['capacity']} guests. "
                    "Please select a suitable room or reduce "
                    "the number of guests."
                ),
            }

        # Recheck availability immediately before creating.
        if not room_is_available(
            room_name,
            check_in,
            check_out,
        ):
            update_conversation(
                session_id,
                {"pending_booking": None},
            )

            return {
                "question": question,
                "answer": (
                    "I'm sorry, this room is no longer available "
                    "for those dates. Please choose another room "
                    "or different dates."
                ),
            }

        result = create_booking(
            guest_name=guest_name.strip(),
            room_name=room_name,
            check_in=check_in,
            check_out=check_out,
            guests=guests,
            rate_per_night=room["rate_per_night"],
        )

        if not result["success"]:
            return {
                "question": question,
                "answer": (
                    f"I could not create the booking: "
                    f"{result['message']}"
                ),
            }

        booking = result.get("booking")

        if booking is None:
            booking_reference = result.get("booking_reference")

            if booking_reference:
                booking = get_booking(booking_reference)

        update_conversation(
            session_id,
            {
                "pending_booking": None,
                "status": "pending",
            },
        )

        if booking:
            nights = (
                datetime.strptime(check_out, "%Y-%m-%d").date()
                - datetime.strptime(check_in, "%Y-%m-%d").date()
            ).days

            total = nights * room["rate_per_night"]

            return {
                "question": question,
                "answer": (
                    "<strong>Booking request created successfully!</strong>"
                    "<br><br>"
                    f"<strong>Booking Reference:</strong> "
                    f"{booking['booking_reference']}<br>"
                    f"<strong>Guest:</strong> {guest_name}<br>"
                    f"<strong>Room:</strong> {room_name}<br>"
                    f"<strong>Check-in:</strong> {check_in}<br>"
                    f"<strong>Check-out:</strong> {check_out}<br>"
                    f"<strong>Guests:</strong> {guests}<br>"
                    f"<strong>Nights:</strong> {nights}<br>"
                    f"<strong>Rate per night:</strong> "
                    f"{room['rate_per_night']:,} NGN<br>"
                    f"<strong>Estimated total:</strong> "
                    f"{total:,} NGN<br>"
                    f"<strong>Status:</strong> {booking['status']}<br><br>"
                    "Please keep your booking reference to check "
                    "your booking later. The booking is pending "
                    "and is not a confirmation of payment."
                ),
            }

        # Fallback if the booking service returns a different shape.
        return {
            "question": question,
            "answer": (
                "The booking service reported success, but I could "
                "not retrieve the booking details. Please check your "
                "booking using the reference returned by the service "
                "or contact the hotel."
            ),
        }

    # --------------------------------------------------------
    # 7. GUEST NAME MEMORY
    # --------------------------------------------------------

    if name_match:
        return {
            "question": question,
            "answer": (
                f"Thank you, {guest_name}. I have saved your name "
                "for this conversation. How may I assist you?"
            ),
        }

    name_patterns = [
        "what is my name",
        "what's my name",
        "whats my name",
        "do you know my name",
        "do you remember my name",
    ]

    if any(pattern in question_lower for pattern in name_patterns):
        guest_name = conversation.get("guest_name")

        if guest_name:
            return {
                "question": question,
                "answer": (
                    f"Your name is <strong>{guest_name}</strong>. "
                    "I remember it for this conversation."
                ),
            }

        return {
            "question": question,
            "answer": (
                "I don't have your name saved yet. Please tell me "
                "your name, for example: "
                "'My name is Adeshina Adewunmi.'"
            ),
        }

    # --------------------------------------------------------
    # 8. MEMORY RECALL
    # --------------------------------------------------------

    if any(
        phrase in question_lower
        for phrase in [
            "what room did i choose",
            "which room did i choose",
            "what room did i select",
            "which room did i select",
            "what room did i book",
            "what room am i staying in",
        ]
    ):
        room_name = conversation.get("room_name")

        if room_name:
            return {
                "question": question,
                "answer": f"You selected the <strong>{room_name}</strong>.",
            }

        return {
            "question": question,
            "answer": "I don't have a room selection saved yet.",
        }

    if any(
        phrase in question_lower
        for phrase in [
            "what dates did i choose",
            "which dates did i choose",
            "what are my dates",
            "when am i staying",
        ]
    ):
        check_in = conversation.get("check_in")
        check_out = conversation.get("check_out")

        if check_in and check_out:
            return {
                "question": question,
                "answer": (
                    f"Your selected stay is from "
                    f"<strong>{check_in}</strong> to "
                    f"<strong>{check_out}</strong>."
                ),
            }

        return {
            "question": question,
            "answer": "I don't have your stay dates saved yet.",
        }

    if any(
        phrase in question_lower
        for phrase in [
            "how many guests did i say",
            "how many guests are staying",
            "how many people are staying",
        ]
    ):
        guests = conversation.get("guests")

        if guests is not None:
            return {
                "question": question,
                "answer": (
                    f"You indicated <strong>{guests} guests</strong>."
                ),
            }

        return {
            "question": question,
            "answer": "I don't have the guest count saved yet.",
        }

    # --------------------------------------------------------
    # 9. ROOM INFORMATION
    # --------------------------------------------------------

    if intent == "rooms":

        if selected_room:
            return {
                "question": question,
                "answer": (
                    f"{selected_room['name']} costs "
                    f"{selected_room['currency']} "
                    f"{selected_room['rate_per_night']:,} per night "
                    f"and accommodates up to "
                    f"{selected_room['capacity']} guests. "
                    f"{selected_room['description']}"
                ),
            }

        return {
            "question": question,
            "answer": [
                {
                    "name": room["name"],
                    "description": room["description"],
                    "rate_per_night": room["rate_per_night"],
                    "currency": room["currency"],
                    "capacity": room["capacity"],
                }
                for room in rooms
            ],
        }

    # --------------------------------------------------------
    # 10. OTHER HOTEL SERVICES
    # --------------------------------------------------------

    if intent == "check_in":
        return {
            "question": question,
            "answer": (
                f"Check-in time at {hotel['name']} is "
                f"<strong>{hotel['check_in']}</strong>. "
                "Early check-in is subject to availability."
            ),
        }

    if intent == "check_out":
        return {
            "question": question,
            "answer": (
                f"Check-out time at {hotel['name']} is "
                f"<strong>{hotel['check_out']}</strong>. "
                "Late check-out is subject to availability "
                "and applicable charges."
            ),
        }

    if intent == "facilities":
        return {
            "question": question,
            "answer": facilities,
        }

    if intent == "restaurant":
        return {
            "question": question,
            "answer": (
                f"<strong>{restaurant['name']}</strong><br><br>"
                f"Cuisine: {restaurant['type']}<br>"
                f"Breakfast: {restaurant['breakfast']}<br>"
                f"Lunch: {restaurant['lunch']}<br>"
                f"Dinner: {restaurant['dinner']}"
            ),
        }

    if intent == "spa":
        return {
            "question": question,
            "answer": (
                f"<strong>{spa['name']}</strong><br><br>"
                f"Opening hours: {spa['opening_hours']}<br>"
                f"Services include: {', '.join(spa['services'])}."
            ),
        }

    if intent == "airport_transfer":
        return {
            "question": question,
            "answer": (
                "Khyle Grand Hotel offers private airport transfer "
                "services. Please request your transfer in advance."
            ),
        }

    if intent == "cancellation":
        return {
            "question": question,
            "answer": (
                "<strong>Cancellation Policy</strong><br><br>"
                f"{policies['cancellation']}"
            ),
        }

    if intent == "smoking":
        return {
            "question": question,
            "answer": (
                "<strong>Smoking Policy</strong><br><br>"
                f"{policies['smoking']}"
            ),
        }

    # --------------------------------------------------------
    # 11. DEFAULT RESPONSE
    # --------------------------------------------------------

    return {
        "question": question,
        "answer": (
            f"Welcome to {hotel['name']}. I can help with room "
            "availability, reservations, room rates, facilities, "
            "restaurant information, spa services, airport transfers, "
            "check-in, check-out, and hotel policies. You can also "
            "provide a booking reference to check an existing booking."
        ),
    }


# ============================================================
# CREATE BOOKING THROUGH THE API
# ============================================================

@app.post("/bookings")
def create_new_booking(booking: BookingRequest):

    selected_room = next(
        (
            room for room in rooms
            if room["name"].lower() == booking.room_name.lower()
        ),
        None,
    )

    if selected_room is None:
        raise HTTPException(
            status_code=404,
            detail="Room not found.",
        )

    if not booking.guest_name.strip():
        raise HTTPException(
            status_code=400,
            detail="Guest name is required.",
        )

    if booking.guests < 1:
        raise HTTPException(
            status_code=400,
            detail="Guest count must be at least 1.",
        )

    if booking.guests > selected_room["capacity"]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{selected_room['name']} accommodates up to "
                f"{selected_room['capacity']} guests."
            ),
        )

    _, _, date_error = validate_dates(
        booking.check_in,
        booking.check_out,
    )

    if date_error:
        raise HTTPException(
            status_code=400,
            detail=date_error,
        )

    result = create_booking(
        guest_name=booking.guest_name.strip(),
        room_name=selected_room["name"],
        check_in=booking.check_in,
        check_out=booking.check_out,
        guests=booking.guests,
        rate_per_night=selected_room["rate_per_night"],
    )

    if not result["success"]:
        raise HTTPException(
            status_code=409,
            detail=result["message"],
        )

    return result


# ============================================================
# LOOK UP EXISTING BOOKING
# ============================================================

@app.get("/bookings/{booking_reference}")
def find_booking(booking_reference: str):

    booking = get_booking(booking_reference)

    if booking is None:
        raise HTTPException(
            status_code=404,
            detail="Booking not found.",
        )

    return booking


# ============================================================
# CHAT PAGE
# ============================================================

@app.get("/chat")
def chat_page():
    return FileResponse("index.html")



# ==========================================
# KHYLE GRAND HOTEL - ADMIN DASHBOARD API
# ==========================================

ADMIN_DATABASE = Path(__file__).resolve().parent / "bookings.db"



@app.get(
    "/admin/api/bookings",
    dependencies=[Depends(require_admin)]
)
def admin_list_bookings(
    search: str = "",
    status: str = "all"
):
    """Return bookings for the hotel admin dashboard."""

    allowed_statuses = {"all", "pending", "confirmed", "cancelled"}

    if status.lower() not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail="Invalid booking status."
        )

    try:
        with sqlite3.connect(str(ADMIN_DATABASE)) as connection:
            connection.row_factory = sqlite3.Row

            query = """
                SELECT
                    id,
                    booking_reference,
                    guest_name,
                    room_name,
                    check_in,
                    check_out,
                    guests,
                    rate_per_night,
                    status,
                    created_at
                FROM bookings
            """

            conditions = []
            parameters = []

            if search.strip():
                term = f"%{search.strip()}%"
                conditions.append(
                    "(booking_reference LIKE ? OR guest_name LIKE ?)"
                )
                parameters.extend([term, term])

            if status.lower() != "all":
                conditions.append("LOWER(status) = ?")
                parameters.append(status.lower())

            if conditions:
                query += " WHERE " + " AND ".join(conditions)

            query += " ORDER BY id DESC"

            rows = connection.execute(
                query, parameters
            ).fetchall()

            bookings = [dict(row) for row in rows]

            return {
                "total": len(bookings),
                "bookings": bookings
            }

    except sqlite3.Error as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not retrieve bookings: {error}"
        )



@app.patch(
    "/admin/api/bookings/{booking_reference}/status",
    dependencies=[Depends(require_admin)]
)
def admin_update_booking_status(
    booking_reference: str,
    status: str
):
    """Apply permitted booking status transitions."""

    new_status = status.strip().lower()

    if new_status not in {"confirmed", "cancelled"}:
        raise HTTPException(
            status_code=400,
            detail="Status must be confirmed or cancelled."
        )

    try:
        with sqlite3.connect(str(ADMIN_DATABASE)) as connection:
            connection.row_factory = sqlite3.Row

            booking = connection.execute(
                """
                SELECT booking_reference, status, room_name, check_in, check_out
FROM bookings
WHERE booking_reference = ?
                """,
                (booking_reference,)
            ).fetchone()

            if booking is None:
                raise HTTPException(
                    status_code=404,
                    detail="Booking reference not found."
                )

            current_status = str(booking["status"]).lower()

            if current_status == new_status:
                return {
                    "message": "Booking already has this status.",
                    "booking_reference": booking_reference,
                    "status": current_status
                }

            if current_status == "cancelled":
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Cancelled bookings cannot be reactivated. "
                        "Create a new booking if necessary."
                    )
                )

            if current_status not in {"pending", "confirmed"}:
                raise HTTPException(
                    status_code=409,
                    detail="This booking has an unsupported status."
                )
            if new_status == "confirmed":
                available = room_is_available(
                    booking["room_name"],
                    booking["check_in"],
                    booking["check_out"],
                    exclude_booking_reference=booking_reference
                )

                if not available:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "This room has another overlapping booking."
                            "Resolve the booking conflict before confirming."
                        )
                    )

            connection.execute(
                """
                UPDATE bookings
                SET status = ?
                WHERE booking_reference = ?
                """,
                (new_status, booking_reference)
            )

            connection.commit()

            return {
                "message": "Booking status updated successfully.",
                "booking_reference": booking_reference,
                "previous_status": current_status,
                "new_status": new_status
            }

    except sqlite3.Error as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not update booking: {error}"
        )


@app.get(
    "/admin",
    dependencies=[Depends(require_admin)]
)
def admin_dashboard():
    """Open the hotel admin dashboard page."""

    dashboard_file = Path(__file__).resolve().parent / "admin.html"

    if not dashboard_file.is_file():
        raise HTTPException(
            status_code=404,
            detail="admin.html has not been created yet."
        )

    return FileResponse(str(dashboard_file))
