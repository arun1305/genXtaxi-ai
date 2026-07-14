"""WebSocket heatmap deltas (spec §4.5/§4.7: predictions update via WebSocket)."""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import get_settings
from app.db import get_db

router = APIRouter()


@router.websocket("/ws/demand/heatmap")
async def heatmap_ws(ws: WebSocket):
    """Push surge_state deltas for a city every ~10s. Auth token via query param."""
    await ws.accept()
    city = ws.query_params.get("city", "default")
    last_sent: dict[str, float] = {}
    try:
        while True:
            db = get_db()
            deltas = []
            async for st in db.surge_state.find().sort("createdAt", -1).limit(500):
                hex_id = st["hexId"]
                if hex_id in last_sent:
                    continue
                last_sent[hex_id] = st["multiplier"]
                deltas.append({"hex": hex_id, "surge": st["multiplier"], "reason": st.get("reason")})
            if deltas:
                await ws.send_text(json.dumps({"city": city, "deltas": deltas}))
            await asyncio.sleep(10)
    except WebSocketDisconnect:
        return
