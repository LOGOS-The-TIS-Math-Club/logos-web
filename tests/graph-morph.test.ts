import assert from "node:assert/strict";
import test from "node:test";
import {
  GRAPH_CYCLE_MS,
  morphGraphAt,
} from "../components/brand/graph-morph.ts";

test("graph stays continuous through shape transitions and the complete loop", () => {
  for (const time of [
    1800,
    8000,
    9800,
    16000,
    17800,
    24000,
    25800,
    GRAPH_CYCLE_MS,
  ]) {
    for (const x of [-1.7, -1, 0, 0.6, 1.7]) {
      assert.ok(
        Math.abs(morphGraphAt(x, time - 1) - morphGraphAt(x, time + 1)) <
          0.00001,
      );
    }
  }
  for (let time = 0; time <= GRAPH_CYCLE_MS; time += 137) {
    for (let x = -1.7; x <= 1.7; x += 0.1) {
      const y = morphGraphAt(x, time);
      assert.ok(Number.isFinite(y) && Math.abs(y) < 1.1);
      assert.ok(Math.abs(y - morphGraphAt(x + 0.001, time)) < 0.003);
    }
  }
});

test("graph holds each shape before morphing and returns to the initial shape", () => {
  for (const x of [-1.5, -0.4, 0, 0.8, 1.5]) {
    for (const time of [0, 8000, 16000, 24000]) {
      assert.equal(morphGraphAt(x, time), morphGraphAt(x, time + 1500));
    }
    assert.equal(morphGraphAt(x, 0), morphGraphAt(x, GRAPH_CYCLE_MS));
  }
  assert.notEqual(morphGraphAt(0.8, 0), morphGraphAt(0.8, 8000));
});
