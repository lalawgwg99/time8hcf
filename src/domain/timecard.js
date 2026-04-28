(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.IppitsuTimecard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const DEFAULT_CATEGORY = 'other';

    function toValidDate(value) {
        const date = value instanceof Date ? value : new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDateKey(date) {
        const validDate = toValidDate(date);
        if (!validDate) return '';
        const year = validDate.getFullYear();
        const month = String(validDate.getMonth() + 1).padStart(2, '0');
        const day = String(validDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getRecordDateKey(record) {
        if (!record || typeof record !== 'object') return '';
        return formatDateKey(record.time);
    }

    function normalizeCategoryKey(categoryKey, categoryKeys) {
        const safeKeys = Array.isArray(categoryKeys) ? categoryKeys : [];
        return safeKeys.includes(categoryKey) ? categoryKey : DEFAULT_CATEGORY;
    }

    function normalizePunchRecord(record, options) {
        if (!record || typeof record !== 'object') return null;
        const time = toValidDate(record.time);
        if (!time) return null;
        const type = record.type === 'out' ? 'out' : 'in';
        return {
            time: typeof record.time === 'string' ? record.time : time.toISOString(),
            type,
            task: typeof record.task === 'string' ? record.task : '',
            category: type === 'in'
                ? normalizeCategoryKey(record.category, options?.categoryKeys)
                : DEFAULT_CATEGORY,
        };
    }

    function buildNormalizedHistory(history, options) {
        const normalizedHistory = {};
        const legacyRecords = Array.isArray(options?.legacyRecords) ? options.legacyRecords : [];
        const historyRecords = Object.values(history || {}).flatMap((records) => Array.isArray(records) ? records : []);

        historyRecords.concat(legacyRecords)
            .map((record) => normalizePunchRecord(record, options))
            .filter(Boolean)
            .forEach((record) => {
                const dateKey = getRecordDateKey(record);
                if (!dateKey) return;
                normalizedHistory[dateKey] = normalizedHistory[dateKey] || [];
                normalizedHistory[dateKey].push(record);
            });

        Object.values(normalizedHistory).forEach((records) => {
            records.sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime());
        });

        return normalizedHistory;
    }

    function settlePastUnclosedSessions(history, todayKey) {
        const settledHistory = {};
        let changed = false;

        Object.entries(history || {}).forEach(([dateKey, records]) => {
            const dayRecords = Array.isArray(records) ? records.slice() : [];
            if (!Array.isArray(records)) changed = true;

            if (dateKey < todayKey && dayRecords.length > 0 && dayRecords.length % 2 !== 0) {
                dayRecords.push({
                    time: `${dateKey}T23:59:59`,
                    type: 'out',
                    task: '（自動結算）',
                    category: DEFAULT_CATEGORY,
                });
                changed = true;
            }

            settledHistory[dateKey] = dayRecords;
        });

        return { history: settledHistory, changed };
    }

    function getNextPunchType(records) {
        return Array.isArray(records) && records.length % 2 !== 0 ? 'out' : 'in';
    }

    function getSessionEndDate(records, index, dateKey, now, todayKey) {
        const nextRecord = records[index + 1];
        if (nextRecord && nextRecord.type === 'out') return toValidDate(nextRecord.time);
        if (dateKey === todayKey) return now;
        return toValidDate(`${dateKey}T23:59:59`);
    }

    function calculateDayTotalMinutes(records, dateKey, options) {
        const safeRecords = Array.isArray(records) ? records : [];
        const now = toValidDate(options?.now) || new Date();
        const todayKey = options?.todayKey || formatDateKey(now);

        return safeRecords.reduce((totalMinutes, record, index) => {
            if (index % 2 !== 0 || !record || record.type !== 'in') return totalMinutes;
            const startDate = toValidDate(record.time);
            const endDate = getSessionEndDate(safeRecords, index, dateKey, now, todayKey);
            if (!startDate || !endDate) return totalMinutes;
            return totalMinutes + Math.max(0, (endDate - startDate) / 60000);
        }, 0);
    }

    function buildSessionSummary(records, options) {
        const safeRecords = Array.isArray(records) ? records : [];
        const now = toValidDate(options?.now) || new Date();

        return safeRecords.reduce((summary, record, index) => {
            if (index % 2 !== 0 || !record || record.type !== 'in') return summary;
            const startDate = toValidDate(record.time);
            const nextRecord = safeRecords[index + 1];
            const endValue = nextRecord && nextRecord.type === 'out' ? nextRecord.time : now.toISOString();
            const endDate = toValidDate(endValue);
            if (!startDate || !endDate) return summary;

            const duration = Math.max(0, (endDate - startDate) / 60000);
            if (duration <= 0) return summary;

            const isOngoing = !(nextRecord && nextRecord.type === 'out');
            summary.total += duration;
            summary.isOngoing = summary.isOngoing || isOngoing;
            summary.sessions.push({ start: record.time, end: isOngoing ? null : endValue, duration });
            return summary;
        }, { total: 0, sessions: [], isOngoing: false });
    }

    function calculateCategoryBreakdown(records, options) {
        const categoryKeys = Array.isArray(options?.categoryKeys) ? options.categoryKeys : [DEFAULT_CATEGORY];
        const todayKey = options?.todayKey || formatDateKey(options?.now || new Date());
        const totals = categoryKeys.reduce((accumulator, categoryKey) => {
            accumulator[categoryKey] = 0;
            return accumulator;
        }, {});

        (Array.isArray(records) ? records : []).forEach((record, index, safeRecords) => {
            if (index % 2 !== 0 || !record || record.type !== 'in') return;
            const dateKey = getRecordDateKey(record) || todayKey;
            const minutes = calculateDayTotalMinutes(safeRecords.slice(index, index + 2), dateKey, options);
            const categoryKey = normalizeCategoryKey(record.category, categoryKeys);
            totals[categoryKey] = (totals[categoryKey] || 0) + minutes;
        });

        return Object.entries(totals)
            .filter(([, minutes]) => minutes > 0)
            .sort((left, right) => right[1] - left[1]);
    }

    return {
        buildNormalizedHistory,
        buildSessionSummary,
        calculateCategoryBreakdown,
        calculateDayTotalMinutes,
        formatDateKey,
        getNextPunchType,
        getRecordDateKey,
        normalizePunchRecord,
        settlePastUnclosedSessions,
    };
});
