# ============================================================
# KHYLE HOTEL AI - CONVERSATION SERVICE
# ============================================================

conversations = {}


# ============================================================
# CREATE OR GET CONVERSATION
# ============================================================

def get_conversation(session_id):

    if session_id not in conversations:

        conversations[session_id] = {
            "guest_name": None,
            "room_name": None,
            "check_in": None,
            "check_out": None,
            "guests": None,
            "status": "new"
        }

    return conversations[session_id]


# ============================================================
# UPDATE CONVERSATION
# ============================================================

def update_conversation(session_id, data):

    conversation = get_conversation(session_id)

    conversation.update(data)

    return conversation


# ============================================================
# CLEAR CONVERSATION
# ============================================================

def clear_conversation(session_id):

    if session_id in conversations:

        del conversations[session_id]