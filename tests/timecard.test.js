const assert = require('node:assert/strict');
const timecard = require('../src/domain/timecard.js');

const categoryKeys = ['deep', 'meeting', 'other'];

function record(time, type, category = 'deep', task = '') {
    return { time, type, category, task };
}

assert.equal(timecard.formatDateKey(new Date(2026, 3, 7)), '2026-04-07');
assert.equal(timecard.getNextPunchType([]), 'in');
assert.equal(timecard.getNextPunchType([record('2026-04-27T09:00:00', 'in')]), 'out');

assert.deepEqual(
    timecard.normalizePunchRecord(record('2026-04-27T09:00:00', 'in', 'unknown'), { categoryKeys }),
    { time: '2026-04-27T09:00:00', type: 'in', task: '', category: 'other' },
);
assert.equal(timecard.normalizePunchRecord({ time: 'not-a-date', type: 'in' }, { categoryKeys }), null);

const normalizedHistory = timecard.buildNormalizedHistory({
    ignoredKey: [
        record('2026-04-26T09:00:00', 'in', 'deep'),
        record('2026-04-26T10:00:00', 'out', 'deep'),
    ],
}, {
    categoryKeys,
    legacyRecords: [record('2026-04-27T11:00:00', 'in', 'meeting')],
});
assert.deepEqual(Object.keys(normalizedHistory).sort(), ['2026-04-26', '2026-04-27']);

const settlement = timecard.settlePastUnclosedSessions(normalizedHistory, '2026-04-27');
assert.equal(settlement.changed, false);

const unclosedSettlement = timecard.settlePastUnclosedSessions({
    '2026-04-26': [record('2026-04-26T09:00:00', 'in', 'deep')],
}, '2026-04-27');
assert.equal(unclosedSettlement.changed, true);
assert.deepEqual(unclosedSettlement.history['2026-04-26'][1], {
    time: '2026-04-26T23:59:59',
    type: 'out',
    task: '（自動結算）',
    category: 'other',
});

assert.equal(
    timecard.calculateDayTotalMinutes([
        record('2026-04-27T09:00:00', 'in', 'deep'),
        record('2026-04-27T10:30:00', 'out', 'deep'),
    ], '2026-04-27', { now: new Date('2026-04-27T12:00:00'), todayKey: '2026-04-27' }),
    90,
);

const summary = timecard.buildSessionSummary([
    record('2026-04-27T09:00:00', 'in', 'deep'),
    record('2026-04-27T10:00:00', 'out', 'deep'),
    record('2026-04-27T11:00:00', 'in', 'meeting'),
], { now: new Date('2026-04-27T12:15:00') });
assert.equal(summary.total, 135);
assert.equal(summary.isOngoing, true);
assert.deepEqual(summary.sessions.map((session) => session.duration), [60, 75]);

const breakdown = timecard.calculateCategoryBreakdown([
    record('2026-04-27T09:00:00', 'in', 'deep'),
    record('2026-04-27T10:00:00', 'out', 'deep'),
    record('2026-04-27T10:30:00', 'in', 'meeting'),
], {
    categoryKeys,
    now: new Date('2026-04-27T12:00:00'),
    todayKey: '2026-04-27',
});
assert.deepEqual(breakdown, [['meeting', 90], ['deep', 60]]);

console.log('timecard domain tests passed');
