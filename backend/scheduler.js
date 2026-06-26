const cron = require('node-cron');
const {
  getShowScheduleByDayOfWeek,
  getOrCreateTodayShow,
  copyScheduleMultipliers,
  getMonday,
  getUrGrantDates,
  grantUrTicketsForDate,
} = require('./db');
const { resolveAllPendingShows } = require('./services/showService');
const { ensureWeeklyPool, invalidateStaleLineups } = require('./services/weeklyPoolService');

const ART_TZ = 'America/Argentina/Buenos_Aires';

function todayART() {
  return new Date().toLocaleDateString('en-CA', { timeZone: ART_TZ });
}

function dayOfWeekART() {
  // Returns 0 (Sun) – 6 (Sat)
  return new Date().toLocaleDateString('en-US', { timeZone: ART_TZ, weekday: 'short' });
}

function artDayIndex() {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return names.indexOf(dayOfWeekART());
}

// Convert a "HH:MM:SS" deadline_time in ART to a UTC ISO string for today.
function deadlineUtc(deadlineTimeStr, dateStr) {
  // dateStr = YYYY-MM-DD in ART
  // ART is UTC-3 (no DST)
  const [h, m, s] = deadlineTimeStr.split(':').map(Number);
  const artMs = Date.UTC(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(5, 7)) - 1,
    parseInt(dateStr.slice(8, 10)),
    h, m, s || 0
  ) + 3 * 3600 * 1000; // add 3h to convert ART→UTC
  return new Date(artMs).toISOString();
}

// Create today's shows for GG (and BG when live) based on day-of-week schedule.
async function createTodayShows() {
  const today = todayART();
  const dow = artDayIndex(); // 0-6
  for (const gender of ['gg']) { // BG excluded from UI; schema ready
    try {
      const schedule = await getShowScheduleByDayOfWeek(dow, gender);
      if (!schedule) {
        console.log(`No show schedule for dow=${dow} gender=${gender}`);
        continue;
      }
      const deadline = deadlineUtc(schedule.deadlineTime, today);
      const show = await getOrCreateTodayShow(today, gender, schedule.id, schedule.showName, deadline);
      console.log(`Show ready: id=${show.id} date=${today} gender=${gender} deadline=${deadline}`);
      if (show.created) {
        const copied = await copyScheduleMultipliers(show.id, schedule.id);
        console.log(`[scheduler] Copied ${copied} multiplier(s) to show ${show.id}`);
      }
    } catch (err) {
      console.error(`Error creating show for ${gender}:`, err);
    }
  }
}

const ROTATED_GENDERS = ['gg'];

async function rotateAllGenders() {
  const weekStart = getMonday();
  for (const gender of ROTATED_GENDERS) {
    try {
      const result = await ensureWeeklyPool(weekStart, gender);
      if (result.noEligibleSongs) {
        console.log(`[scheduler] [${gender}] No eligible songs — pool unchanged.`);
      } else if (result.created) {
        console.log(`[scheduler] [${gender}] Pool CREATED for ${result.weekStartDate}: ${result.selected.length} songs (fresh: ${result.freshCount}, reused: ${result.reusedCount})${result.underTarget ? ' UNDER TARGET' : ''}`);
      } else {
        console.log(`[scheduler] [${gender}] Pool already present for ${result.weekStartDate} (${result.selected.length} songs) — no changes.`);
      }
      const invalidated = await invalidateStaleLineups(weekStart, gender);
      if (invalidated > 0) {
        console.log(`[scheduler] [${gender}] Lineups invalidated: ${invalidated}`);
      }
    } catch (err) {
      console.error(`[scheduler] [${gender}] Rotation error:`, err);
    }
  }
}

// Annual Ultra-Rare ticket grant. On each operator-configured grant date
// (ur_grant_dates), every registered player gains exactly one UR ticket.
// Idempotent across restarts and repeat daily runs via the ur_grant_log marker.
async function processAnnualUrGrant() {
  try {
    const today = todayART();              // YYYY-MM-DD in ART
    const month = parseInt(today.slice(5, 7), 10);
    const day = parseInt(today.slice(8, 10), 10);

    const dates = await getUrGrantDates();
    const matches = dates.some(d => d.month === month && d.day === day);
    if (!matches) return; // not a configured grant date — no-op

    const { granted, usersAffected } = await grantUrTicketsForDate(today);
    if (granted) {
      console.log(`[scheduler] Annual UR grant: +1 ticket to ${usersAffected} user(s) for ${today}.`);
    } else {
      console.log(`[scheduler] Annual UR grant: ${today} already processed — no change.`);
    }
  } catch (err) {
    console.error('[scheduler] Annual UR grant failed:', err);
  }
}

function initScheduler() {
  // Create today's shows at midnight ART (03:00 UTC)
  cron.schedule('0 3 * * *', async () => {
    console.log('[scheduler] Creating today\'s shows...');
    await createTodayShows();
    await processAnnualUrGrant();
  }, { timezone: 'UTC' });

  // Resolve overdue shows every minute
  cron.schedule('* * * * *', async () => {
    await resolveAllPendingShows();
  }, { timezone: 'UTC' });

  // Weekly pool rotation: Monday 03:00 UTC = 00:00 ART Monday
  cron.schedule('0 3 * * 1', async () => {
    console.log('[scheduler] Rotating weekly song pools...');
    await rotateAllGenders();
  }, { timezone: 'UTC' });

  // Also create shows on startup (in case server restarted mid-day)
  createTodayShows().catch(err => console.error('[scheduler] Startup show creation failed:', err));

  // Catch up the annual UR grant on startup (restart on a grant date still grants once)
  processAnnualUrGrant().catch(err => console.error('[scheduler] Startup UR grant failed:', err));

  // Catch up any missed weekly rotation on startup
  rotateAllGenders().catch(err => console.error('[scheduler] Startup pool rotation failed:', err));

  console.log('[scheduler] Initialized: show creation + pool rotation at 03:00 UTC Monday, show resolution every minute.');
}

module.exports = { initScheduler };
