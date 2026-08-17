// Realtime event bus. Services emit events; the WS server subscribes and
// broadcasts to clients in the right resort room.

import { EventEmitter } from "node:events";

export type ServerEvent =
  | { type: "BOOKING_CREATED"; data: { reservation: unknown } }
  | { type: "BOOKING_UPDATED"; data: { reservation: unknown } }
  | { type: "BOOKING_CANCELLED"; data: { id: string } }
  | { type: "BOOKING_CHECKED_IN"; data: { id: string } }
  | { type: "BOOKING_CHECKED_OUT"; data: { id: string } }
  | { type: "BOOKING_EXTENDED"; data: { id: string; newCheckOut: string } }
  | { type: "PAYMENT_CAPTURED"; data: { reservationId: string; amount: number } }
  | { type: "ROOM_STATUS_CHANGED"; data: { roomId: string; status: string } }
  | { type: "ROOM_ASSIGNED"; data: { reservationId: string; roomId: string } }
  | { type: "ROOM_MOVED"; data: { reservationId: string; fromRoomId: string; toRoomId: string } }
  | { type: "HOUSEKEEPING_TASK_CREATED"; data: { task: unknown } }
  | { type: "HOUSEKEEPING_TASK_UPDATED"; data: { task: unknown } }
  | { type: "ENQUIRY_CREATED"; data: { enquiry: unknown } }
  | { type: "HOLD_EXPIRED"; data: { holdId: string } }
  | { type: "EXTENSION_REQUESTED"; data: { reservationId: string } }
  | { type: "EXTENSION_DECIDED"; data: { id: string; decision: "APPROVED" | "REJECTED" } };

class EventBus extends EventEmitter {
  emitEvent(resortId: string, event: ServerEvent): void {
    this.emit(`resort:${resortId}`, event);
  }
  onResort(resortId: string, listener: (event: ServerEvent) => void): () => void {
    const channel = `resort:${resortId}`;
    this.on(channel, listener);
    return () => this.off(channel, listener);
  }
}

export const eventBus = new EventBus();
eventBus.setMaxListeners(1000);
