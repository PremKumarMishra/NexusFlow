from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.websockets import WebSocket,WebSocketDisconnect
from fastapi.responses import StreamingResponse,Response
from vision_engine import VisionEngine,EngineConfig
from schema.model import VenueConfig
from network.mobile import MobileConnectionManager,get_mobile_telemetry,get_mobile_vconfig
from typing import List
import uvicorn
import threading
import asyncio
import cv2
import time

class WebsocketManager:
    def __init__(self):
        self.active_connections:List[WebSocket] = []

    async def connect(self,conn:WebSocket):
        await conn.accept()
        self.active_connections.append(conn)
        print("[WS] Client Connected")

    def disconnect(self,conn:WebSocket):
        if conn in self.active_connections:
            self.active_connections.remove(conn)
        print("[WS] Client Disconnected")

    async def broadcast(self,paylod):
        disconnected_clients = []
        for connection in self.active_connections:
            try:
                await connection.send_json(paylod)
            except:
                disconnected_clients.append(connection)

        for client in disconnected_clients:
            self.disconnect(client)

app = FastAPI(title="CrowdShield",version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_headers=["*"],
    allow_methods=["*"],
    allow_credentials=True
)

engine_config = EngineConfig()
vision_engine = VisionEngine("model/best.pt",engine_config)

manager = WebsocketManager()
mobile_manager = MobileConnectionManager()
mobile_manager.configure(manager)

#Temporary Variables
VIDEO_SOURCE = "assets/s4.mp4"
latest_jpeg_frame = b""
latest_raw_frame =  None
latest_telemetry = dict()

frame_lock = threading.Lock()
fps = 30.0

main_event_loop = None
new_frame_event:asyncio.Event = None

def simulate_cctv_stream(source):
    global latest_jpeg_frame,latest_raw_frame,fps

    cap = cv2.VideoCapture(VIDEO_SOURCE,cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_HW_ACCELERATION,cv2.VIDEO_ACCELERATION_ANY)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open video stream source: {VIDEO_SOURCE}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_delay = 1/fps

    print(f"[CCTV] Simulated camera feed active @ {fps:.1f} FPS. Processing started...")

    while True:
        loop_start = time.perf_counter()
        ret,frame = cap.read()

        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES,0)
            # frame_idx = 0
            continue

        with frame_lock:
            latest_raw_frame = frame.copy()
        
        stream_frame = cv2.resize(frame, (640, 360))
        success,jpeg_frame = cv2.imencode(".jpg",stream_frame,[int(cv2.IMWRITE_JPEG_QUALITY),75])
        if success:
            latest_jpeg_frame = jpeg_frame.tobytes()
            if main_event_loop and new_frame_event:
                main_event_loop.call_soon_threadsafe(new_frame_event.set)

        elpased = time.perf_counter() - loop_start
        sleep_duration = frame_delay - elpased
        if sleep_duration > 0:
            time.sleep(sleep_duration)

def process_ai_vision():
    global latest_telemetry
    frame_idx = 0
    frame_skip = 3
    TELEMETRY_EMIT_INTERVAL = 0.25
    last_telemetry_emit = 0.0

    while True:
        frame_idx+=1
        with frame_lock:
            if latest_raw_frame is None:
                time.sleep(0.01)
                continue
            frame = latest_raw_frame.copy()

        if frame_idx % frame_skip != 0:
            time.sleep(0.01)
            continue

        current_timestamp = round(time.time(), 2)
        
        _,telemetry = vision_engine.process_frame(frame,current_timestamp)
        latest_telemetry = telemetry

        now = time.time()
        if (now - last_telemetry_emit >= TELEMETRY_EMIT_INTERVAL):
            if main_event_loop:
                if manager.active_connections:
                    asyncio.run_coroutine_threadsafe(manager.broadcast(latest_telemetry),main_event_loop)
                if mobile_manager.connections:
                    mobile_telemetry = get_mobile_telemetry(latest_telemetry)
                    asyncio.run_coroutine_threadsafe(mobile_manager.broadcast(mobile_telemetry),main_event_loop)

            last_telemetry_emit = now

async def generate_mjpeg_stream():
    while True:
        await new_frame_event.wait()
        new_frame_event.clear()
        if latest_jpeg_frame:
            yield (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' + latest_jpeg_frame + b'\r\n'
            )

@app.on_event("startup")
async def on_app_startup():
    global main_event_loop,new_frame_event
    # Grab the FastAPI async loop
    main_event_loop = asyncio.get_running_loop()
    new_frame_event = asyncio.Event()
    
    # CCTV Stream Thread
    stream_thread = threading.Thread(target=simulate_cctv_stream,args=(VIDEO_SOURCE,),daemon=True)
    stream_thread.start()
    print("[SERVER] Background CCTV Steam Thread Started.")

    # Vision Thread
    vision_thread = threading.Thread(target=process_ai_vision,daemon=True)
    vision_thread.start()
    print("[AI] Background Vision Thread Started.")


@app.get("/api/v1/stream/cam1")
def get_camera_stream():
    return StreamingResponse(generate_mjpeg_stream(),media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/api/v1/stream/cam1/frame")
async def get_current_camera_frame():
    await new_frame_event.wait()
    new_frame_event.clear()
    if latest_jpeg_frame:
        return Response(content=latest_jpeg_frame,media_type="image/jpeg")

@app.post("/api/v1/venue/config")
async def update_venue_config(venue:VenueConfig):
    vision_engine.venue_config = venue.model_dump(mode="json")
    payload = get_mobile_vconfig(vision_engine.venue_config.copy())
    await mobile_manager.broadcast(payload)

@app.get("/api/v1/telemetry/current")
def get_current_telemetry():
    return latest_telemetry

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        if latest_telemetry:
            await websocket.send_json(latest_telemetry)
        
        while True:
            await websocket.receive_json()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.websocket("/ws/mobile")
async def websocket_mobile(websocket:WebSocket):
    payload = get_mobile_vconfig(vision_engine.venue_config.copy())
    await mobile_manager.connect(websocket)
    await mobile_manager.send_venue_config(websocket,payload)
    await mobile_manager.recv_process(websocket)


if __name__ == "__main__":
    uvicorn.run("server:app",host="0.0.0.0",port=8000)