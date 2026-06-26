// Seed ClubHub with rich demo data
// Run: bun run /home/z/my-project/scripts/seed.ts
//
// Dev credentials created by this script (DEV ONLY — do not deploy to prod):
//   SUPER_ADMIN:  superadmin@roster.local  /  roster-dev-super-123
//   SCHOOL_ADMIN: principal@school.edu       /  roster-dev-admin-123
//   ADVISOR:      <advisor emails below>    /  roster-dev-admin-123
//   Students + parents: no password (cookie/session login not supported for them in dev).

import { db } from '../src/lib/db'
import { PrismaClient } from '@prisma/client'
import { createServiceClient } from '../src/lib/supabase-server'

const FIRST_NAMES = [
  'Aiden','Aisha','Alex','Amara','Anthony','Aria','Asher','Ava','Axel','Bella',
  'Benjamin','Brianna','Caleb','Camila','Carter','Chloe','Daniel','David','Diego','Dylan',
  'Eden','Eli','Elena','Emma','Ethan','Ezra','Fatima','Felix','Gabriel','Grace',
  'Hannah','Harper','Henry','Isaac','Isabella','Isaiah','Jade','Jasmine','Jayden','Jocelyn',
  'Jordan','Kai','Karter','Kayla','Khloe','Kinsley','Knox','Layla','Leo','Liam',
  'Lila','Lincoln','Logan','Lucas','Luna','Maddox','Makayla','Mara','Marcus','Mateo',
  'Maya','Mia','Mila','Muhammad','Nadia','Nathan','Nina','Noah','Nora','Oliver',
  'Olivia','Omar','Owen','Paige','Parker','Penelope','Peyton','Quinn','Riley','Riya',
  'Ryker','Sadie','Samuel','Sara','Sebastian','Sienna','Silas','Sofia','Sophia','Stella',
  'Sydney','Talia','Theodore','Trevor','Tyler','Valentina','Victor','Violet','Wyatt','Yara',
  'Yusuf','Zara','Zion','Zoe','Adrian','Alina','Andres','Anika','Astrid','Bodhi',
  'Camille','Cassius','Coco','Dakota','Darius','Dulce','Ember','Esther','Fern','Fiona',
  'Gemma','Giovanni','Halle','Hank','Iris','Jaxon','Kai','Khalil','Lena','Lyra',
  'Maeve','Mariana','Nico','Noor','Orion','Paloma','Quincy','Rhea','Rosa','Sage',
  'Sami','Soren','Tariq','Uma','Vera','Wren','Ximena','Yoshi','Zane','Zola'
]

const LAST_NAMES = [
  'Adams','Alvarez','Anderson','Baker','Brown','Cabrera','Campbell','Carter','Chen','Clark',
  'Collins','Davis','Diaz','Edwards','Evans','Fischer','Foster','Garcia','Gomez','Green',
  'Gupta','Hall','Harris','Hernandez','Hill','Hughes','Ibarra','Jackson','Jenkins','Johnson',
  'Jones','Kapoor','Kennedy','Khan','Kim','King','Kumar','Lee','Lewis','Liu',
  'Lopez','Martinez','Mason','Mendez','Miller','Mitchell','Moore','Morgan','Morris','Nakamura',
  'Nelson','Nguyen','Olsen','Park','Patel','Perez','Phillips','Powell','Quinn','Reed',
  'Reyes','Rivera','Roberts','Robinson','Rodriguez','Rogers','Romero','Ross','Russell','Sanchez',
  'Sanders','Scott','Sharma','Smith','Snyder','Stewart','Sullivan','Suzuki','Taylor','Thomas',
  'Thompson','Torres','Turner','Walker','Wang','Washington','Watson','White','Williams','Wilson',
  'Wong','Wright','Yamamoto','Young','Zhang','Ahmed','Ali','Bhattacharya','Cohen','Davies'
]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  const result: T[] = []
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length)
    result.push(copy.splice(idx, 1)[0])
  }
  return result
}

async function main() {
  console.log('Clearing existing data...')
  // Delete in dependency order
  await db.checkIn.deleteMany()
  await db.attendance.deleteMany()
  await db.event.deleteMany()
  await db.userBadge.deleteMany()
  await db.badge.deleteMany()
  await db.announcement.deleteMany()
  await db.clubSetting.deleteMany()
  await db.customField.deleteMany()
  await db.membership.deleteMany()
  await db.parentGuardian.deleteMany()
  await db.clubInvite.deleteMany()
  await db.auditLog.deleteMany()
  await db.club.deleteMany()
  await db.user.deleteMany()
  console.log('Cleared.')

  // -----------------------------------------------------
  // 0) SUPER_ADMIN bootstrap user (created FIRST so audit logs etc. can
  //    reference it). Created via Supabase Auth admin API so the password
  //    works with Supabase Auth login.
  // -----------------------------------------------------
  const supabase = createServiceClient()
  const ADMIN_EMAIL = 'admin@roster.app'
  const ADMIN_PASSWORD = 'roster-admin-2026'

  const { data: adminAuthData, error: adminAuthError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'Roster Super Admin', role: 'SUPER_ADMIN' },
  })

  let adminAuthId: string | undefined = adminAuthData?.user?.id
  if (adminAuthError && adminAuthError.message.includes('already')) {
    const { data: list } = await supabase.auth.admin.listUsers()
    adminAuthId = list?.users?.find((u: any) => u.email === ADMIN_EMAIL)?.id
  }

  const superAdmin = await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      name: 'Roster Super Admin',
      email: ADMIN_EMAIL,
      role: 'SUPER_ADMIN',
      supabaseAuthId: adminAuthId,
      house: 'Administration',
    },
    update: {
      role: 'SUPER_ADMIN',
      supabaseAuthId: adminAuthId,
    },
  })
  console.log(`Created SUPER_ADMIN bootstrap user: ${superAdmin.email}`)

  // -----------------------------------------------------
  // 1) FACULTY ADVISORS
  // -----------------------------------------------------
  const advisors: Awaited<ReturnType<typeof db.user.create>>[] = []
  const advisorNames = [
    { name: 'Dr. Emily Carter', email: 'e.carter@school.edu', dept: 'Science' },
    { name: 'Mr. James Lee', email: 'j.lee@school.edu', dept: 'Athletics' },
    { name: 'Ms. Sofia Martinez', email: 's.martinez@school.edu', dept: 'Arts' },
    { name: 'Mrs. Anne Thompson', email: 'a.thompson@school.edu', dept: 'English' },
    { name: 'Mr. David Kim', email: 'd.kim@school.edu', dept: 'STEM' },
  ]
  for (const a of advisorNames) {
    // Create in Supabase Auth
    const { data: authData } = await supabase.auth.admin.createUser({
      email: a.email,
      password: 'roster-dev-admin-123',
      email_confirm: true,
      user_metadata: { name: a.name, role: 'ADVISOR' },
    }).catch(() => ({ data: null }))
    advisors.push(await db.user.create({
      data: { name: a.name, email: a.email, role: 'ADVISOR', house: a.dept, supabaseAuthId: authData?.user?.id }
    }))
  }

  // -----------------------------------------------------
  // 2) STUDENTS — 220 of them across grades 9-12
  // -----------------------------------------------------
  console.log('Creating 220 students...')
  const students: Awaited<ReturnType<typeof db.user.create>>[] = []
  const grades = [9, 10, 11, 12]
  const gradYearFor = (g: number) => 2026 + (12 - g)
  for (let i = 0; i < 220; i++) {
    const fn = randomItem(FIRST_NAMES)
    const ln = randomItem(LAST_NAMES)
    const grade = randomItem(grades)
    const sid = `S${String(10000 + i).padStart(5, '0')}`
    students.push(await db.user.create({
      data: {
        name: `${fn} ${ln}`,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@student.school.edu`.replace(/'/g, ''),
        role: 'STUDENT',
        studentId: sid,
        grade,
        graduationYear: gradYearFor(grade),
        house: randomItem(['Athena', 'Apollo', 'Hermes', 'Artemis', 'Poseidon', 'Hera']),
        phone: `+1555${randomInt(1000000, 9999999)}`,
        pronouns: randomItem(['she/her', 'he/him', 'they/them', 'she/her', 'he/him']),
      }
    }))
  }

  // School admin
  const { data: principalAuth } = await supabase.auth.admin.createUser({
    email: 'principal@school.edu',
    password: 'roster-dev-admin-123',
    email_confirm: true,
    user_metadata: { name: 'Principal Olivia Wang', role: 'SCHOOL_ADMIN' },
  }).catch(() => ({ data: null }))
  await db.user.create({
    data: {
      name: 'Principal Olivia Wang',
      email: 'principal@school.edu',
      role: 'SCHOOL_ADMIN',
      house: 'Administration',
      supabaseAuthId: principalAuth?.user?.id,
    }
  })

  // -----------------------------------------------------
  // 3) CLUBS — 5 well-fleshed-out clubs
  // -----------------------------------------------------
  console.log('Creating 5 clubs...')
  const clubSpecs = [
    {
      name: 'Robotics & Engineering Society',
      description: 'Building robots, programming microcontrollers, and competing in FIRST Tech Challenge. Open to all grades — no experience required!',
      category: 'STEM',
      primaryColor: '#0ea5e9',
      accentColor: '#22c55e',
      advisorId: advisors[4].id,
      meetingRoom: 'Engineering Lab 204',
      defaultDay: 'TUESDAY',
      defaultTime: '15:30',
      capacity: 60,
      dues: 25,
      // Realistic mix for a robotics club: core 3 + announcements (comms),
      // tasks (project tracking), inventory (parts & kits), maintenance
      // (broken robots). Doesn't use: finance (no dues collection beyond
      // a flat fee), volunteer hours (not a service club), gamification,
      // parent portal (high school — parents don't check in on robotics).
      modules: ['members', 'attendance', 'events', 'announcements', 'tasks', 'inventory', 'maintenance'],
    },
    {
      name: 'Debate & Model UN',
      description: 'Sharp arguments, global issues, public speaking mastery. We compete locally and travel to national MUN conferences.',
      category: 'ACADEMIC',
      primaryColor: '#a855f7',
      accentColor: '#ec4899',
      advisorId: advisors[3].id,
      meetingRoom: 'Humanities Hall 110',
      defaultDay: 'WEDNESDAY',
      defaultTime: '15:15',
      capacity: 40,
      dues: 40,
      // Debate club: core 3 + finance (competition travel costs money),
      // announcements (tournament schedule), applications (selective).
      modules: ['members', 'attendance', 'events', 'announcements', 'finance', 'applications'],
    },
    {
      name: 'Jazz Ensemble',
      description: 'From bebop to fusion, we rehearse weekly and perform at school concerts, jazz festivals, and community events.',
      category: 'ARTS',
      primaryColor: '#f97316',
      accentColor: '#facc15',
      advisorId: advisors[2].id,
      meetingRoom: 'Music Room 101',
      defaultDay: 'MONDAY',
      defaultTime: '15:30',
      capacity: 25,
      dues: 30,
      // Jazz: core 3 + announcements (concert schedule), resources
      // (instrument booking), inventory (school-owned instruments).
      modules: ['members', 'attendance', 'events', 'announcements', 'resources', 'inventory'],
    },
    {
      name: 'Environmental Action Club',
      description: 'Campus composting, river cleanups, climate advocacy. Volunteer hours available for all participants.',
      category: 'SERVICE',
      primaryColor: '#10b981',
      accentColor: '#14b8a6',
      advisorId: advisors[0].id,
      meetingRoom: 'Greenhouse 1',
      defaultDay: 'THURSDAY',
      defaultTime: '15:30',
      capacity: 50,
      dues: 0,
      // Service club: core 3 + volunteer hours (NHS credit), announcements,
      // digests (weekly recap to members).
      modules: ['members', 'attendance', 'events', 'announcements', 'volunteer', 'digests'],
    },
    {
      name: 'Varsity Mathletes',
      description: 'Competitive mathematics — AMC/AIME/ARML prep, weekly problem sets, and regional math competitions.',
      category: 'ACADEMIC',
      primaryColor: '#6366f1',
      accentColor: '#8b5cf6',
      advisorId: advisors[0].id,
      meetingRoom: 'Math Wing 305',
      defaultDay: 'FRIDAY',
      defaultTime: '15:15',
      capacity: 30,
      dues: 15,
      // Mathletes: core 3 + applications (selective), announcements.
      // Tiny club, minimal modules.
      modules: ['members', 'attendance', 'events', 'announcements', 'applications'],
    },
  ]
  const clubs: Awaited<ReturnType<typeof db.club.create>>[] = []
  for (const spec of clubSpecs) {
    const memberCount = randomInt(28, Math.min(spec.capacity, 55))
    const clubMembers = pickN(students, memberCount)
    const president = clubMembers[0]
    const vp = clubMembers[1]
    const secretary = clubMembers[2]
    const treasurer = clubMembers[3]

    const club = await db.club.create({
      data: {
        name: spec.name,
        description: spec.description,
        category: spec.category as any,
        primaryColor: spec.primaryColor,
        accentColor: spec.accentColor,
        advisorId: spec.advisorId,
        presidentId: president.id,
        meetingRoom: spec.meetingRoom,
        defaultDay: spec.defaultDay,
        defaultTime: spec.defaultTime,
        capacity: spec.capacity,
        dues: spec.dues,
        isPublic: true,
        requireApproval: spec.category === 'ACADEMIC',
        status: 'ACTIVE',
        modules: JSON.stringify(spec.modules ?? ['members', 'attendance', 'events']),
      }
    })
    clubs.push(club)

    // Create club settings
    await db.clubSetting.create({
      data: { clubId: club.id }
    })

    // Memberships with roles
    const roleAssignments: { user: typeof president, role: any }[] = [
      { user: president, role: 'PRESIDENT' },
      { user: vp, role: 'VICE_PRESIDENT' },
      { user: secretary, role: 'SECRETARY' },
      { user: treasurer, role: 'TREASURER' },
    ]
    for (let i = 4; i < Math.min(8, clubMembers.length); i++) {
      roleAssignments.push({ user: clubMembers[i], role: 'COMMITTEE_HEAD' })
    }
    for (let i = 8; i < clubMembers.length; i++) {
      roleAssignments.push({ user: clubMembers[i], role: 'MEMBER' })
    }
    for (const a of roleAssignments) {
      await db.membership.create({
        data: {
          userId: a.user.id,
          clubId: club.id,
          role: a.role,
          points: randomInt(0, 200),
          streak: randomInt(0, 12),
          longestStreak: randomInt(2, 20),
          joinedAt: new Date(Date.now() - randomInt(7, 240) * 86400000),
        }
      })
    }

    // Custom fields
    if (spec.category === 'STEM') {
      await db.customField.create({ data: { clubId: club.id, name: 'experience_level', label: 'Experience Level', type: 'SELECT', options: JSON.stringify(['Beginner', 'Intermediate', 'Advanced']), required: true, sortOrder: 1 } })
      await db.customField.create({ data: { clubId: club.id, name: 'tshirt_size', label: 'T-Shirt Size', type: 'TSHIRT_SIZE', options: JSON.stringify(['XS','S','M','L','XL','XXL']), required: true, sortOrder: 2 } })
      await db.customField.create({ data: { clubId: club.id, name: 'team_role', label: 'Preferred Team Role', type: 'SELECT', options: JSON.stringify(['Programmer','Builder','Driver','Notebook','Outreach']), required: false, sortOrder: 3 } })
      await db.customField.create({ data: { clubId: club.id, name: 'emergency_contact', label: 'Emergency Contact', type: 'EMERGENCY_CONTACT', required: true, sortOrder: 4 } })
    } else if (spec.category === 'ARTS') {
      await db.customField.create({ data: { clubId: club.id, name: 'instrument', label: 'Primary Instrument', type: 'TEXT', required: true, sortOrder: 1 } })
      await db.customField.create({ data: { clubId: club.id, name: 'years_playing', label: 'Years Playing', type: 'NUMBER', required: true, sortOrder: 2 } })
      await db.customField.create({ data: { clubId: club.id, name: 'music_theory', label: 'Music Theory Level', type: 'RADIO', options: JSON.stringify(['None','Beginner','Intermediate','Advanced']), required: false, sortOrder: 3 } })
    } else if (spec.category === 'SERVICE') {
      await db.customField.create({ data: { clubId: club.id, name: 'volunteer_hours_goal', label: 'Semester Volunteer Hours Goal', type: 'NUMBER', required: true, sortOrder: 1 } })
      await db.customField.create({ data: { clubId: club.id, name: 'interests', label: 'Interests', type: 'MULTISELECT', options: JSON.stringify(['Climate','Wildlife','Recycling','Education','Food Security']), required: false, sortOrder: 2 } })
    } else if (spec.category === 'ACADEMIC') {
      await db.customField.create({ data: { clubId: club.id, name: 'grade_level', label: 'Current Math Class', type: 'SELECT', options: JSON.stringify(['Algebra 2','Pre-Calc','Calc AB','Calc BC','Stats']), required: true, sortOrder: 1 } })
      await db.customField.create({ data: { clubId: club.id, name: 'competition_history', label: 'Previous Competitions', type: 'TEXTAREA', required: false, sortOrder: 2 } })
    }

    // Badges
    const badgeSpecs = [
      { name: 'Perfect Attendance', description: 'Attended 10 meetings in a row', icon: '🎯', color: '#10b981', tier: 'GOLD', points: 50 },
      { name: 'Rising Star', description: 'First 5 meetings attended', icon: '⭐', color: '#f59e0b', tier: 'BRONZE', points: 20 },
      { name: 'MVP', description: 'Outstanding contribution', icon: '🏆', color: '#ef4444', tier: 'GOLD', points: 100 },
      { name: 'Helping Hand', description: 'Volunteered 20+ hours', icon: '🤝', color: '#3b82f6', tier: 'SILVER', points: 40 },
      { name: 'Streak Master', description: '30-day attendance streak', icon: '🔥', color: '#f97316', tier: 'PLATINUM', points: 75 },
    ]
    for (const bs of badgeSpecs) {
      const badge = await db.badge.create({
        data: { clubId: club.id, name: bs.name, description: bs.description, icon: bs.icon, color: bs.color, tier: bs.tier, points: bs.points }
      })
      // Award to some members
      const awardees = pickN(clubMembers, randomInt(3, 10))
      for (const a of awardees) {
        try {
          await db.userBadge.create({
            data: { userId: a.id, badgeId: badge.id, awardedAt: new Date(Date.now() - randomInt(1, 60) * 86400000) }
          })
        } catch (e) { /* unique constraint skip */ }
      }
    }

    // Announcements
    const announcementSpecs = [
      { title: 'Welcome to the new semester!', content: `Exciting times ahead for ${spec.name}. Our first meeting is this week — bring your friends!`, priority: 'HIGH', isPinned: true, category: 'general' },
      { title: 'Reminder: Dues due Friday', content: `Please submit your $${spec.dues} dues to the treasurer by Friday. Cash or check made out to "${spec.name}".`, priority: 'NORMAL', isPinned: false, category: 'dues' },
      { title: 'Volunteer opportunity', content: 'Community cleanup event Saturday 9 AM at Riverside Park. Counts for service hours!', priority: 'NORMAL', isPinned: false, category: 'service' },
      { title: 'Competition signups open', content: 'Sign up for the regional competition. Limited spots available — first come first served.', priority: 'HIGH', isPinned: false, category: 'competition' },
    ]
    for (const an of announcementSpecs) {
      await db.announcement.create({
        data: {
          clubId: club.id,
          authorId: president.id,
          title: an.title,
          content: an.content,
          priority: an.priority as any,
          isPinned: an.isPinned,
          category: an.category,
          scheduledFor: new Date(Date.now() - randomInt(1, 14) * 86400000),
          createdAt: new Date(Date.now() - randomInt(1, 14) * 86400000),
        }
      })
    }
  }

  // -----------------------------------------------------
  // 4) EVENTS — 6 months of meetings + special events
  // -----------------------------------------------------
  console.log('Creating events for past 6 months...')
  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())

  for (const club of clubs) {
    const dayMap: Record<string, number> = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 }
    const meetingDay = dayMap[club.defaultDay || 'TUESDAY']
    const [hh, mm] = (club.defaultTime || '15:30').split(':').map(Number)
    const eventTypeMap: Record<string, any> = {
      STEM: 'MEETING',
      ACADEMIC: 'MEETING',
      ARTS: 'REHEARSAL',
      SERVICE: 'VOLUNTEER',
    }

    // Weekly recurring meetings
    let cursor = new Date(sixMonthsAgo)
    // align to first matching day
    while (cursor.getDay() !== meetingDay) {
      cursor.setDate(cursor.getDate() + 1)
    }
    let meetingNum = 0
    while (cursor <= now) {
      const start = new Date(cursor)
      start.setHours(hh, mm, 0, 0)
      const end = new Date(start)
      end.setMinutes(end.getMinutes() + 90)
      // Skip holidays roughly (e.g., winter break Dec 20 - Jan 5)
      const m = start.getMonth()
      const d = start.getDate()
      if ((m === 11 && d >= 20) || (m === 0 && d <= 5)) {
        cursor.setDate(cursor.getDate() + 7)
        continue
      }
      const event = await db.event.create({
        data: {
          clubId: club.id,
          title: `${club.name.split(' ')[0]} Weekly Meeting`,
          description: `Regular weekly meeting #${++meetingNum}`,
          type: eventTypeMap[club.category] || 'MEETING',
          startTime: start,
          endTime: end,
          location: club.meetingRoom,
          isRecurring: true,
          status: start < now ? 'COMPLETED' : 'SCHEDULED',
          creatorId: club.presidentId,
        }
      })

      // Generate attendance for past events
      if (start < now) {
        const members = await db.membership.findMany({ where: { clubId: club.id, status: 'ACTIVE' }, select: { userId: true, joinedAt: true } })
        // Only members who joined before this meeting
        const eligible = members.filter(m => m.joinedAt <= start)
        // Random attendance: 70-90% present, rest late/excused/absent
        const attendanceRate = 0.7 + Math.random() * 0.2
        for (const m of eligible) {
          const r = Math.random()
          let status: any = 'PRESENT'
          let method: any = null
          if (r < attendanceRate) {
            // Present, late, or virtual
            const subR = Math.random()
            if (subR < 0.85) { status = 'PRESENT'; method = randomItem(['QR_CODE', 'KIOSK', 'SELF_CHECKIN']) }
            else if (subR < 0.95) { status = 'LATE'; method = randomItem(['QR_CODE', 'KIOSK']) }
            else { status = 'VIRTUAL'; method = 'SELF_CHECKIN' }
          } else {
            // Absent, excused, or no-show
            const subR = Math.random()
            if (subR < 0.5) status = 'EXCUSED'
            else if (subR < 0.85) status = 'ABSENT'
            else status = 'NO_SHOW'
          }
          const checkInTime = status === 'PRESENT' || status === 'LATE' || status === 'VIRTUAL'
            ? new Date(start.getTime() + randomInt(-10, status === 'LATE' ? 20 : 10) * 60000)
            : null
          await db.attendance.create({
            data: {
              eventId: event.id,
              userId: m.userId,
              status,
              method,
              checkInTime,
              pointsEarned: status === 'PRESENT' ? 5 : status === 'LATE' ? 3 : status === 'VIRTUAL' ? 4 : 0,
            }
          })
        }
      }
      cursor.setDate(cursor.getDate() + 7)
    }

    // Special events: 2-4 per club
    const specialEventSpecs = [
      { title: 'Fall Kickoff Social', type: 'SOCIAL', daysBack: 150, duration: 180, cap: 80, req: false },
      { title: 'Regional Competition', type: 'COMPETITION', daysBack: 80, duration: 480, cap: 15, req: true },
      { title: 'Winter Showcase', type: 'PERFORMANCE', daysBack: 45, duration: 180, cap: 100, req: false },
      { title: 'Spring Fundraiser', type: 'FUNDRAISER', daysBack: 20, duration: 240, cap: 50, req: false },
      { title: 'End-of-Year Banquet', type: 'SOCIAL', daysBack: -10, duration: 180, cap: 120, req: false }, // upcoming
    ]
    for (const se of specialEventSpecs) {
      const start = new Date(now.getTime() - se.daysBack * 86400000)
      start.setHours(18, 0, 0, 0)
      const end = new Date(start.getTime() + se.duration * 60000)
      const event = await db.event.create({
        data: {
          clubId: club.id,
          title: se.title,
          description: `${se.title} for ${club.name}.`,
          type: se.type as any,
          startTime: start,
          endTime: end,
          location: randomItem(['Main Gym', 'Auditorium', 'Cafeteria', 'Library', club.meetingRoom || 'TBD']),
          capacity: se.cap,
          isRequired: se.req,
          status: start < now ? 'COMPLETED' : 'SCHEDULED',
          creatorId: club.presidentId,
        }
      })
      // Attendance for past special events
      if (start < now) {
        const members = await db.membership.findMany({ where: { clubId: club.id, status: 'ACTIVE' }, select: { userId: true, joinedAt: true } })
        const eligible = members.filter(m => m.joinedAt <= start)
        const rate = se.type === 'COMPETITION' ? 0.3 : se.type === 'FUNDRAISER' ? 0.6 : 0.85
        for (const m of eligible) {
          if (Math.random() < rate) {
            await db.attendance.create({
              data: {
                eventId: event.id,
                userId: m.userId,
                status: 'PRESENT',
                method: randomItem(['QR_CODE', 'KIOSK']),
                checkInTime: new Date(start.getTime() + randomInt(-15, 15) * 60000),
                pointsEarned: se.type === 'COMPETITION' ? 30 : 15,
              }
            })
          } else if (Math.random() < 0.3) {
            await db.attendance.create({
              data: {
                eventId: event.id,
                userId: m.userId,
                status: 'EXCUSED',
                pointsEarned: 0,
              }
            })
          }
        }
      }
    }
  }

  // -----------------------------------------------------
  // 5) Audit log entries
  // -----------------------------------------------------
  console.log('Creating audit log entries...')
  const admin = await db.user.findFirst({ where: { role: 'SCHOOL_ADMIN' } })
  const auditActions = [
    { action: 'create', entity: 'Club', note: 'Created club' },
    { action: 'update', entity: 'Club', note: 'Updated meeting time' },
    { action: 'create', entity: 'Event', note: 'Scheduled event' },
    { action: 'create', entity: 'Membership', note: 'Added member' },
    { action: 'update', entity: 'Attendance', note: 'Marked attendance' },
    { action: 'export', entity: 'Attendance', note: 'Exported attendance report' },
    { action: 'create', entity: 'Badge', note: 'Awarded badge' },
    { action: 'create', entity: 'Announcement', note: 'Posted announcement' },
  ]
  for (let i = 0; i < 40; i++) {
    const a = randomItem(auditActions)
    const club = randomItem(clubs)
    await db.auditLog.create({
      data: {
        userId: admin?.id,
        action: a.action,
        entity: a.entity,
        entityId: club.id,
        clubId: club.id,
        before: a.action === 'update' ? ({ field: 'old value' } as any) : null,
        after: a.action === 'update' ? ({ field: 'new value' } as any) : ({ note: a.note } as any),
        timestamp: new Date(Date.now() - randomInt(0, 60) * 86400000),
      }
    })
  }

  // -----------------------------------------------------
  // 6) A few Parent accounts + relationships
  // -----------------------------------------------------
  console.log('Creating parent accounts...')
  for (let i = 0; i < 15; i++) {
    const student = randomItem(students)
    const fn = randomItem(FIRST_NAMES)
    const ln = student.name.split(' ')[1]
    const parent = await db.user.create({
      data: {
        name: `${fn} ${ln}`,
        email: `parent.${ln.toLowerCase()}.${i}@email.com`,
        role: 'PARENT',
      }
    })
    try {
      await db.parentGuardian.create({
        data: {
          parentId: parent.id,
          studentId: student.id,
          relationship: randomItem(['Mother', 'Father', 'Guardian']),
          canExcuseAbsences: true,
        }
      })
    } catch (e) { /* skip if conflict */ }
  }

  console.log('Seed complete!')
  console.log('Users:', await db.user.count())
  console.log('Clubs:', await db.club.count())
  console.log('Memberships:', await db.membership.count())
  console.log('Events:', await db.event.count())
  console.log('Attendance records:', await db.attendance.count())
  console.log('Badges:', await db.badge.count())
  console.log('User badges:', await db.userBadge.count())
  console.log('Announcements:', await db.announcement.count())
  console.log('Audit logs:', await db.auditLog.count())
  console.log('Custom fields:', await db.customField.count())
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
