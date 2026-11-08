import { beforeAll, afterAll, test, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { wellbeingPaths, type WellbeingKind } from "@vitalis/contracts";
const app = await buildApp();
let a = "",
  b = "",
  ta = "",
  tb = "",
  secondary = "";
const h = (token = ta, profile = a) => ({
  authorization: `Bearer ${token}`,
  "x-profile-id": profile,
});
const push = (mutation: object, token = ta) =>
  app.inject({
    method: "POST",
    url: "/v1/sync",
    headers: h(token, token === ta ? a : b),
    payload: { mutations: [mutation] },
  });
const mutation = (
  payload: object,
  profileId = a,
  action = "upsert",
  entityId?: string,
) => ({
  mutationId: crypto.randomUUID(),
  profileId,
  entity: "wellbeing",
  action,
  payload,
  entityId,
  clientUpdatedAt: "2000-01-01T00:00:00Z",
});
const fixtures: Record<WellbeingKind, object> = {
  workoutPlan: { days: [{ weekday: 1, type: "walk", time: "08:00" }] },
  medication: {
    name: "Synthetic",
    dosage: "Informada",
    weekdays: [1, 3],
    times: ["08:00"],
    enabled: true,
  },
  breathingReminder: { time: "20:00", enabled: true },
  breathing: {
    startedAt: "2026-11-07T10:00:00Z",
    completedAt: "2026-11-07T10:03:00Z",
    activeSeconds: 180,
  },
  sleep: { date: "2026-11-07", durationMinutes: 480 },
  mood: {
    occurredAt: "2026-11-07T10:00:00Z",
    score: 3,
    notes: "QA",
    symptoms: ["Fadiga"],
    mealIds: [],
    activityIds: [],
  },
  fasting: {
    startAt: "2026-11-07T10:00:00Z",
    endAt: "2026-11-07T11:00:00Z",
    status: "completed",
  },
  bloodPressure: {
    occurredAt: "2026-11-07T10:00:00Z",
    systolic: 120,
    diastolic: 80,
  },
};
beforeAll(async () => {
  await app.ready();
  for (const n of [0, 1]) {
    const r = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        name: "QA Sprint22",
        email: `s22-${crypto.randomUUID()}@example.com`,
        password: "qa-12345678",
        passwordConfirmation: "qa-12345678",
      },
    });
    expect(r.statusCode).toBe(201);
    if (n === 0) {
      a = r.json().data.profile.id;
      ta = r.json().data.tokens.accessToken;
    } else {
      b = r.json().data.profile.id;
      tb = r.json().data.tokens.accessToken;
    }
  }
  const r = await app.inject({
    method: "POST",
    url: "/v1/profiles",
    headers: h(),
    payload: { id: crypto.randomUUID(), name: "Familiar QA" },
  });
  expect(r.statusCode).toBe(201);
  secondary = r.json().data.id;
});
afterAll(async () => {
  for (const id of [a, b]) if (id) await prisma.user.delete({ where: { id } });
  await app.close();
});
test("all wellbeing endpoints CRUD, profile/account isolation, invalid inputs and tombstones", async () => {
  for (const [kind, path] of Object.entries(wellbeingPaths)) {
    const id = crypto.randomUUID(),
      data = fixtures[kind as WellbeingKind];
    const created = await app.inject({
      method: "POST",
      url: "/v1/" + path,
      headers: h(),
      payload: { id, data },
    });
    expect(created.statusCode, created.body).toBe(201);
    expect(
      (await app.inject({ url: "/v1/" + path + "/" + id, headers: h() })).json()
        .data.kind,
    ).toBe(kind);
    expect(
      (
        await app.inject({
          url: "/v1/" + path + "/" + id,
          headers: h(ta, secondary),
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ url: "/v1/" + path + "/" + id, headers: h(tb, b) }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/v1/" + path + "/" + id,
          headers: h(),
          payload: { data },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/v1/" + path + "/" + id,
          headers: h(tb, b),
          payload: { data },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/" + path,
          headers: h(),
          payload: { id: crypto.randomUUID(), data: {} },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: "/v1/" + path + "/" + id,
          headers: h(),
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (await app.inject({ url: "/v1/" + path + "/" + id, headers: h() }))
        .statusCode,
    ).toBe(404);
  }
  const denied = await app.inject({ url: "/v1/sleep", headers: h(ta, b) });
  expect(denied.statusCode).toBe(404);
});
test("incremental sync orders revisions, replays preserve timestamps, paging and lost-response convergence", async () => {
  const id = crypto.randomUUID(),
    m = mutation({ id, kind: "sleep", data: fixtures.sleep });
  expect((await push(m)).json().data[0].status).toBe("applied");
  const before = await prisma.wellbeingRecord.findUniqueOrThrow({
    where: { id },
  });
  expect((await push(m)).json().data[0].status).toBe("applied");
  const after = await prisma.wellbeingRecord.findUniqueOrThrow({
    where: { id },
  });
  expect(after.updatedAt).toEqual(before.updatedAt);
  expect(after.revision).toBe(before.revision);
  const foreign = await push(
    mutation({ id, kind: "sleep", data: fixtures.sleep }, b),
    tb,
  );
  expect(foreign.json().data[0].status).toBe("failed");
  let cursor = "0",
    hasMore = true;
  const ids: string[] = [];
  while (hasMore) {
    const r = await app.inject({
      url: "/v1/wellbeing/sync?limit=3&cursor=" + cursor,
      headers: h(),
    });
    expect(r.statusCode).toBe(200);
    const page = r.json().data;
    expect(page.records.length).toBeLessThanOrEqual(3);
    for (const row of page.records) {
      expect(BigInt(row.revision)).toBeGreaterThan(BigInt(cursor));
      ids.push(row.id);
    }
    cursor = page.cursor;
    hasMore = page.hasMore;
  }
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toContain(id);
  const update = mutation({
    id,
    kind: "sleep",
    data: { ...fixtures.sleep, durationMinutes: 500 },
  });
  await push(update);
  const page = (
    await app.inject({
      url: "/v1/wellbeing/sync?cursor=" + cursor,
      headers: h(),
    })
  ).json().data;
  expect(page.records).toHaveLength(1);
  expect(page.records[0].data.durationMinutes).toBe(500);
  expect(
    (await push(mutation({}, a, "delete", id))).json().data[0].status,
  ).toBe("applied");
  expect(
    (
      await app.inject({
        url: "/v1/wellbeing/sync?cursor=" + page.cursor,
        headers: h(),
      })
    ).json().data.records[0].deletedAt,
  ).not.toBeNull();
  expect(
    (
      await app.inject({
        url: "/v1/wellbeing/sync?cursor=invalid",
        headers: h(),
      })
    ).statusCode,
  ).toBe(400);
});
test("one active fasting is enforced under concurrent requests; cancellation releases it", async () => {
  const data = {
    startAt: new Date().toISOString(),
    endAt: new Date(Date.now() + 3600000).toISOString(),
    status: "active",
  };
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  const responses = await Promise.all(
    ids.map((id) =>
      app.inject({
        method: "POST",
        url: "/v1/fasting",
        headers: h(),
        payload: { id, data },
      }),
    ),
  );
  expect(responses.map((r) => r.statusCode).sort()).toEqual([201, 409]);
  const winner = ids[responses.findIndex((r) => r.statusCode === 201)]!;
  await app.inject({
    method: "PUT",
    url: "/v1/fasting/" + winner,
    headers: h(),
    payload: { data: { ...data, status: "cancelled" } },
  });
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/v1/fasting",
        headers: h(),
        payload: { id: crypto.randomUUID(), data },
      })
    ).statusCode,
  ).toBe(201);
});
test("mood links reject foreign/deleted additions while preserving previously associated tombstones", async () => {
  const meal = crypto.randomUUID();
  await prisma.meal.create({
    data: {
      id: meal,
      userId: a,
      profileId: a,
      name: "QA",
      date: new Date("2026-11-07"),
      time: "12:00",
      quantity: 1,
      unit: "g",
      calories: 1,
    },
  });
  const id = crypto.randomUUID(),
    data = { ...fixtures.mood, mealIds: [meal] };
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/v1/mood",
        headers: h(),
        payload: { id, data },
      })
    ).statusCode,
  ).toBe(201);
  await prisma.meal.update({
    where: { id: meal },
    data: { deletedAt: new Date() },
  });
  expect(
    (
      await app.inject({
        method: "PUT",
        url: "/v1/mood/" + id,
        headers: h(),
        payload: { data: { ...data, notes: "edit" } },
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/v1/mood",
        headers: h(tb, b),
        payload: { id: crypto.randomUUID(), data },
      })
    ).statusCode,
  ).toBe(400);
});
test("friends authorization, minimal DTO, private default and legacy edits preserve new fields", async () => {
  const activityId = crypto.randomUUID(),
    input = {
      id: activityId,
      type: "run",
      date: "2026-11-07",
      durationSeconds: 60,
      distanceMeters: 100,
      route: [],
    };
  const created = await app.inject({
    method: "POST",
    url: "/v1/activities",
    headers: h(),
    payload: input,
  });
  expect(created.statusCode, created.body).toBe(201);
  expect(created.json().data.visibility).toBe("private");
  const code = (
    await app.inject({
      method: "POST",
      url: "/v1/friend-invites",
      headers: h(),
    })
  ).json().data.code;
  const request = await app.inject({
    method: "POST",
    url: "/v1/friend-requests",
    headers: h(tb, b),
    payload: { code },
  });
  expect(request.statusCode, request.body).toBe(200);
  const fid = request.json().data.id;
  expect(
    (
      await app.inject({
        url: `/v1/friends/${a}/activities`,
        headers: h(tb, b),
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: "PATCH",
        url: "/v1/friendships/" + fid,
        headers: h(tb, b),
        payload: { action: "accept" },
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await app.inject({
        method: "PATCH",
        url: "/v1/friendships/" + fid,
        headers: h(),
        payload: { action: "accept" },
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await app.inject({
        url: `/v1/friends/${a}/activities`,
        headers: h(tb, b),
      })
    ).json().data,
  ).toHaveLength(0);
  await app.inject({
    method: "PATCH",
    url: "/v1/activities/" + activityId,
    headers: h(),
    payload: {
      visibility: "friends",
      heartRate: { source: "manual", averageBpm: 100 },
    },
  });
  const legacy = {
    mutationId: crypto.randomUUID(),
    entity: "activity",
    action: "upsert",
    payload: input,
    clientUpdatedAt: new Date().toISOString(),
  };
  expect((await push(legacy)).json().data[0].status).toBe("applied");
  const row = await prisma.activity.findUniqueOrThrow({
    where: { id: activityId },
  });
  expect(row.visibility).toBe("friends");
  expect(row.heartRate).toEqual({ source: "manual", averageBpm: 100 });
  const list = await app.inject({
    url: `/v1/friends/${a}/activities`,
    headers: h(tb, b),
  });
  expect(list.json().data).toHaveLength(1);
  expect(Object.keys(list.json().data[0]).sort()).toEqual(
    [
      "id",
      "date",
      "type",
      "durationSeconds",
      "distanceMeters",
      "calories",
    ].sort(),
  );
  expect(
    (
      await app.inject({
        url: `/v1/friends/${a}/activities/${activityId}`,
        headers: h(tb, b),
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await app.inject({
        url: "/v1/activities/" + activityId,
        headers: h(tb, a),
      })
    ).statusCode,
  ).toBe(404);
  await app.inject({
    method: "PATCH",
    url: "/v1/activities/" + activityId,
    headers: h(),
    payload: { visibility: "private" },
  });
  expect(
    (
      await app.inject({
        url: `/v1/friends/${a}/activities/${activityId}`,
        headers: h(tb, b),
      })
    ).statusCode,
  ).toBe(404);
  await app.inject({
    method: "PATCH",
    url: "/v1/friendships/" + fid,
    headers: h(),
    payload: { action: "remove" },
  });
  expect(
    (
      await app.inject({
        url: `/v1/friends/${a}/activities`,
        headers: h(tb, b),
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/v1/friend-requests",
        headers: h(tb, b),
        payload: { code },
      })
    ).statusCode,
  ).toBe(400);
});
