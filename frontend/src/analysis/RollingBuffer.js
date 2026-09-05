/**
 * Fixed-capacity ring buffer. Used to hold the last N frames' worth of a
 * value (e.g. a knee angle, or a visibility boolean) for rolling-window
 * heuristics like ExerciseVerifier.
 *
 * Implementation is a plain array with head-eviction (not an index-based
 * ring) — capacities used in this app are small (tens of frames), so the
 * O(1) amortized shift cost is not worth the complexity of a true circular
 * buffer.
 */
export class RollingBuffer {
  /** @param {number} capacity must be a positive integer */
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error(`RollingBuffer: capacity must be a positive integer, got ${capacity}`);
    }
    this.capacity = capacity;
    /** @type {any[]} */
    this._items = [];
  }

  /** @param {any} value */
  push(value) {
    this._items.push(value);
    if (this._items.length > this.capacity) {
      this._items.shift();
    }
  }

  /** @returns {any[]} oldest-first snapshot */
  toArray() {
    return this._items.slice();
  }

  /** @returns {number} */
  size() {
    return this._items.length;
  }

  clear() {
    this._items = [];
  }
}
