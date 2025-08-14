type Listener = (...args: any[]) => void;

class Emitter {
  private listeners: Map<string, Set<Listener>> = new Map();

  on(event: string, cb: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return () => this.off(event, cb);
  }

  off(event: string, cb: Listener) {
    this.listeners.get(event)?.delete(cb);
  }

  emit(event: string, ...args: any[]) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of Array.from(set)) {
      try { cb(...args); } catch {}
    }
  }
}

export const events = new Emitter();

export const TrackerEvents = {
  SessionsChanged: 'tracker:sessionsChanged',
  AttachmentsChanged: 'tracker:attachmentsChanged',
} as const;

export type TrackerEventName = typeof TrackerEvents[keyof typeof TrackerEvents];

export function on(event: TrackerEventName, cb: Listener) { return events.on(event, cb); }
export function off(event: TrackerEventName, cb: Listener) { return events.off(event, cb); }
export function emit(event: TrackerEventName, ...args: any[]) { return events.emit(event, ...args); }
