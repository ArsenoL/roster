// Phase 2 Seed: Adds data for all new Phase 2 modules on top of existing Phase 1 data
// Run: bun run /home/z/my-project/scripts/seed-phase2.ts

import { db } from '../src/lib/db'

function randomItem<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min }
function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr]; const result: T[] = []
  for (let i = 0; i < n && copy.length > 0; i++) result.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0])
  return result
}

async function main() {
  console.log('=== Phase 2 Seed ===')

  // 0) Add slugs + extra club fields to existing clubs
  console.log('Updating clubs with slugs and Phase 2 fields...')
  const clubs = await db.club.findMany()
  for (const club of clubs) {
    const slug = club.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    await db.club.update({
      where: { id: club.id },
      data: {
        slug,
        mission: `To inspire, educate, and empower students through ${club.category.toLowerCase()} excellence and community engagement.`,
        foundedYear: 2018 + randomInt(0, 6),
        tags: JSON.stringify([club.category.toLowerCase(), 'high-school', 'student-led']),
      },
    })
    // Upsert settings with Phase 2 enabled
    await db.clubSetting.upsert({
      where: { clubId: club.id },
      update: {
        enableRsvp: true,
        enablePublicPortal: true,
        enableApplications: true,
        enableAlumniTracking: true,
        enableAiInsights: true,
        enableInventory: true,
        enableResources: true,
        enableForms: true,
        enablePolls: true,
        enableTasks: true,
        enableFinance: true,
        enableDocuments: true,
        enableCommittees: true,
        enableCalendarSync: true,
      },
      create: { clubId: club.id },
    })
  }

  const users = await db.user.findMany({ where: { role: 'STUDENT' } })
  const allMemberships = await db.membership.findMany({ include: { user: true, club: true } })

  // ============================================================
  // 1) FINANCE — Transactions + Budgets
  // ============================================================
  console.log('Creating finance data...')
  // Clear first
  await db.transaction.deleteMany()
  await db.budget.deleteMany()

  const txCategories = ['dues', 'supplies', 'fundraiser', 'equipment', 'travel', 'food', 'prize', 'venue', 'marketing', 'other']
  const paymentMethods = ['cash', 'check', 'card', 'paypal', 'venmo']
  for (const club of clubs) {
    const members = allMemberships.filter(m => m.clubId === club.id)
    // 30-50 transactions per club
    for (let i = 0; i < randomInt(30, 50); i++) {
      const daysAgo = randomInt(1, 240)
      const date = new Date(Date.now() - daysAgo * 86400000)
      const type = randomItem(['INCOME', 'EXPENSE', 'DUE_PAYMENT', 'EXPENSE', 'EXPENSE'])
      const isIncome = type === 'INCOME' || type === 'DUE_PAYMENT'
      const member = members.length > 0 ? randomItem(members) : null
      await db.transaction.create({
        data: {
          clubId: club.id,
          type: type as any,
          category: type === 'DUE_PAYMENT' ? 'dues' : randomItem(txCategories),
          amount: isIncome ? (type === 'DUE_PAYMENT' ? club.dues : randomInt(50, 1500)) : parseFloat((Math.random() * 400 + 10).toFixed(2)),
          description: randomItem([
            'Weekly meeting supplies',
            'Pizza for end-of-year party',
            'T-shirt order',
            'Competition registration fee',
            'Equipment maintenance',
            'Transportation for field trip',
            'Guest speaker honorarium',
            'Fundraiser proceeds',
            'Member dues payment',
            'Decoration materials',
            'Software subscription',
            'Photo prints for showcase',
          ]),
          date,
          recordedById: club.presidentId,
          memberId: type === 'DUE_PAYMENT' && member ? member.id : null,
          status: 'COMPLETED',
          paymentMethod: randomItem(paymentMethods),
        },
      })
    }
    // 2-4 budgets per club
    const budgetCats = ['supplies', 'equipment', 'travel', 'food', 'marketing']
    for (let i = 0; i < randomInt(2, 4); i++) {
      const allocated = randomInt(200, 2000)
      await db.budget.create({
        data: {
          clubId: club.id,
          name: `${randomItem(['Fall', 'Spring', 'Annual', 'Competition'])} ${randomItem(budgetCats)}`,
          category: randomItem(budgetCats),
          allocated,
          spent: parseFloat((allocated * (0.3 + Math.random() * 0.7)).toFixed(2)),
          startDate: new Date(Date.now() - randomInt(30, 120) * 86400000),
          endDate: Math.random() > 0.5 ? new Date(Date.now() + randomInt(30, 90) * 86400000) : null,
        },
      })
    }
  }

  // ============================================================
  // 2) VOLUNTEER HOURS
  // ============================================================
  console.log('Creating volunteer hours...')
  await db.volunteerHours.deleteMany()
  for (const club of clubs) {
    if (club.category !== 'SERVICE' && Math.random() > 0.5) continue  // primarily for service clubs
    const members = allMemberships.filter(m => m.clubId === club.id)
    for (const m of pickN(members, randomInt(5, 15))) {
      const entries = randomInt(1, 5)
      for (let i = 0; i < entries; i++) {
        await db.volunteerHours.create({
          data: {
            clubId: club.id,
            userId: m.userId,
            hours: parseFloat((Math.random() * 5 + 1).toFixed(1)),
            date: new Date(Date.now() - randomInt(1, 180) * 86400000),
            description: randomItem([
              'Community garden maintenance',
              'Beach cleanup',
              'Tutoring elementary students',
              'Food bank sorting',
              'Animal shelter assistance',
              'Recycling drive',
              'Tree planting event',
              'Senior center visit',
            ]),
            organization: randomItem(['Local Food Bank', 'Riverside Cleanup Org', 'City Library', 'Humane Society', 'Community Center', null]),
            location: randomItem(['Downtown', 'Riverside Park', 'Community Center', 'School Grounds', null]),
            supervisor: randomItem(['Jane Smith', 'Mark Johnson', 'Dr. Lee', null]),
            status: randomItem(['APPROVED', 'APPROVED', 'PENDING', 'APPROVED', 'REJECTED']),
            approvedById: club.advisorId,
            approvedAt: new Date(Date.now() - randomInt(0, 30) * 86400000),
          },
        })
      }
    }
  }

  // ============================================================
  // 3) POLLS & ELECTIONS
  // ============================================================
  console.log('Creating polls...')
  await db.pollVote.deleteMany()
  await db.pollOption.deleteMany()
  await db.poll.deleteMany()
  for (const club of clubs) {
    const members = allMemberships.filter(m => m.clubId === club.id)
    const pollSpecs = [
      { title: 'Next semester project theme', type: 'SINGLE_CHOICE', options: ['Sustainability', 'Mental Health', 'Tech Literacy', 'Community Art'], official: false, status: 'CLOSED' },
      { title: 'T-shirt design preference', type: 'SINGLE_CHOICE', options: ['Option A - Minimal', 'Option B - Bold', 'Option C - Vintage', 'Option D - Gradient'], official: false, status: 'OPEN' },
      { title: 'Spring banquet date', type: 'SINGLE_CHOICE', options: ['May 15', 'May 22', 'May 29', 'June 5'], official: false, status: 'OPEN' },
      { title: 'President Election 2026', type: 'SINGLE_CHOICE', options: members.slice(0, 3).map(m => m.user.name), official: true, status: 'CLOSED' },
      { title: 'Pizza toppings for next meeting', type: 'MULTIPLE_CHOICE', options: ['Pepperoni', 'Mushroom', 'Sausage', 'Olives', 'Pineapple', 'Bacon'], official: false, status: 'DRAFT' },
    ]
    for (const ps of pollSpecs) {
      const poll = await db.poll.create({
        data: {
          clubId: club.id,
          title: ps.title,
          type: ps.type as any,
          status: ps.status as any,
          allowMultiple: ps.type === 'MULTIPLE_CHOICE',
          allowAnonymous: true,
          showResults: ps.status === 'CLOSED',
          startDate: new Date(Date.now() - randomInt(7, 30) * 86400000),
          endDate: new Date(Date.now() + randomInt(-5, 14) * 86400000),
          isOfficial: ps.official,
        },
      })
      const optionRecords: Awaited<ReturnType<typeof db.pollOption.create>>[] = []
      for (let i = 0; i < ps.options.length; i++) {
        const opt = await db.pollOption.create({
          data: { pollId: poll.id, text: ps.options[i], sortOrder: i },
        })
        optionRecords.push(opt)
      }
      // Cast votes
      if (ps.status !== 'DRAFT') {
        const voters = pickN(members, randomInt(10, members.length))
        for (const v of voters) {
          const numChoices = ps.type === 'MULTIPLE_CHOICE' ? randomInt(1, 3) : 1
          const chosen = pickN(optionRecords, numChoices)
          for (const opt of chosen) {
            await db.pollVote.create({
              data: { pollId: poll.id, optionId: opt.id, userId: v.userId },
            }).catch(() => {})
          }
        }
      }
    }
  }

  // ============================================================
  // 4) FORMS
  // ============================================================
  console.log('Creating forms...')
  await db.formResponse.deleteMany()
  await db.customField.deleteMany({ where: { formId: { not: null } } })
  await db.form.deleteMany()
  for (const club of clubs) {
    const members = allMemberships.filter(m => m.clubId === club.id)
    const formSpecs = [
      {
        title: 'End-of-Semester Feedback',
        type: 'FEEDBACK',
        fields: [
          { name: 'q1', label: 'How satisfied are you with the club this semester?', type: 'RATING' },
          { name: 'q2', label: 'What was your favorite activity?', type: 'TEXT' },
          { name: 'q3', label: 'What would you improve?', type: 'TEXTAREA' },
          { name: 'q4', label: 'Would you recommend this club to a friend?', type: 'SELECT', options: JSON.stringify(['Definitely', 'Probably', 'Maybe', 'No']) },
        ],
        responses: 12,
      },
      {
        title: 'Spring Trip RSVP',
        type: 'RSVP',
        fields: [
          { name: 'q1', label: 'Will you attend the spring trip?', type: 'SELECT', options: JSON.stringify(['Yes, definitely!', 'Maybe', 'No, cannot make it']) },
          { name: 'q2', label: 'Dietary restrictions', type: 'TEXT' },
          { name: 'q3', label: 'Emergency contact name & phone', type: 'TEXT' },
        ],
        responses: 18,
      },
      {
        title: 'T-Shirt Order Form',
        type: 'TSHIRT_ORDER',
        fields: [
          { name: 'q1', label: 'Size', type: 'TSHIRT_SIZE', options: JSON.stringify(['XS', 'S', 'M', 'L', 'XL', 'XXL']) },
          { name: 'q2', label: 'Quantity', type: 'NUMBER' },
          { name: 'q3', label: 'Name for personalization', type: 'TEXT' },
        ],
        responses: 22,
      },
    ]
    for (const fs of formSpecs) {
      const form = await db.form.create({
        data: {
          clubId: club.id,
          title: fs.title,
          type: fs.type as any,
          status: 'OPEN',
          isAnonymous: false,
          collectName: true,
          successMessage: 'Thank you for your response!',
          deadline: new Date(Date.now() + randomInt(7, 30) * 86400000),
        },
      })
      for (let i = 0; i < fs.fields.length; i++) {
        const f = fs.fields[i]
        await db.customField.create({
          data: {
            formId: form.id,
            name: f.name, label: f.label, type: f.type as any,
            options: (f as any).options || null,
            required: true, sortOrder: i, isVisible: true, isEditable: true, appliesTo: 'form',
          },
        })
      }
      // Generate responses
      const responders = pickN(members, Math.min(fs.responses, members.length))
      for (const r of responders) {
        const data: any = {}
        for (const f of fs.fields) {
          if (f.type === 'RATING') data[f.name] = randomInt(3, 5)
          else if (f.type === 'NUMBER') data[f.name] = randomInt(1, 3)
          else if (f.type === 'SELECT') {
            const opts = JSON.parse((f as any).options || '[]')
            data[f.name] = randomItem(opts)
          } else if (f.type === 'TSHIRT_SIZE') {
            const opts = JSON.parse((f as any).options || '[]')
            data[f.name] = randomItem(opts)
          } else {
            data[f.name] = randomItem(['Great experience!', 'Loved the competitions', 'More hands-on activities please', 'The social events were fun', 'Would love more guest speakers'])
          }
        }
        await db.formResponse.create({
          data: {
            formId: form.id,
            userId: r.userId,
            data: JSON.stringify(data),
            submittedAt: new Date(Date.now() - randomInt(1, 14) * 86400000),
          },
        })
      }
    }
  }

  // ============================================================
  // 5) TASKS & COMMITTEES
  // ============================================================
  console.log('Creating committees and tasks...')
  await db.task.deleteMany()
  await db.committeeMember.deleteMany()
  await db.committee.deleteMany()
  await db.taskList.deleteMany()
  for (const club of clubs) {
    const members = allMemberships.filter(m => m.clubId === club.id)
    // 3-5 committees per club
    const committeeNames = ['Outreach', 'Events', 'Marketing', 'Fundraising', 'Competition Prep', 'Social Media', 'Logistics']
    const committees: Awaited<ReturnType<typeof db.committee.create>>[] = []
    for (const cn of pickN(committeeNames, randomInt(3, 5))) {
      const lead = randomItem(members)
      const cMembers = pickN(members, randomInt(3, 8))
      const committee = await db.committee.create({
        data: {
          clubId: club.id,
          name: cn,
          description: `Handles ${cn.toLowerCase()} initiatives for ${club.name}.`,
          leadId: lead.userId,
          color: randomItem(['#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b', '#10b981']),
          members: {
            create: [{ userId: lead.userId, role: 'lead' }, ...cMembers.filter(m => m.userId !== lead.userId).map(m => ({ userId: m.userId, role: 'member' }))],
          },
        },
      })
      committees.push(committee)
    }
    // Task lists
    const listNames = ['Backlog', 'In Progress', 'Done']
    const lists: Awaited<ReturnType<typeof db.taskList.create>>[] = []
    for (let i = 0; i < listNames.length; i++) {
      lists.push(await db.taskList.create({
        data: { clubId: club.id, name: listNames[i], color: ['#6b7280', '#3b82f6', '#10b981'][i], sortOrder: i },
      }))
    }
    // 12-20 tasks per club
    const taskSpecs = [
      'Order supplies for next meeting',
      'Reserve auditorium for showcase',
      'Send weekly reminder email',
      'Update social media with photos',
      'Plan spring fundraiser logistics',
      'Submit budget report to advisor',
      'Coordinate with guest speaker',
      'Print flyers for recruitment',
      'Organize team building activity',
      'Review competition rules',
      'Update club website',
      'Prepare presentation for school board',
      'Collect t-shirt sizes from members',
      'Schedule field trip transportation',
      'Draft meeting agenda',
      'Follow up with new applicants',
      'Inventory check on equipment',
      'Send thank-you notes to donors',
    ]
    for (const title of pickN(taskSpecs, randomInt(12, 18))) {
      const status = randomItem(['TODO', 'TODO', 'IN_PROGRESS', 'IN_PROGRESS', 'DONE', 'DONE', 'DONE'])
      await db.task.create({
        data: {
          clubId: club.id,
          listId: status === 'DONE' ? lists[2].id : status === 'IN_PROGRESS' ? lists[1].id : lists[0].id,
          title,
          description: `Task: ${title}`,
          status: status as any,
          priority: randomItem(['LOW', 'MEDIUM', 'MEDIUM', 'HIGH', 'URGENT']),
          assigneeId: randomItem(members).userId,
          creatorId: club.presidentId,
          committeeId: randomItem(committees).id,
          dueDate: new Date(Date.now() + randomInt(-14, 30) * 86400000),
          completedAt: status === 'DONE' ? new Date(Date.now() - randomInt(1, 14) * 86400000) : null,
        },
      })
    }
  }

  // ============================================================
  // 6) RESOURCES
  // ============================================================
  console.log('Creating resources...')
  await db.resourceBooking.deleteMany()
  await db.resource.deleteMany()
  for (const club of clubs) {
    const resourceSpecs = [
      { name: `${club.meetingRoom || 'Meeting Room'}`, type: 'ROOM', capacity: 30 },
      { name: 'Auditorium A', type: 'AUDITORIUM', capacity: 200 },
      { name: 'Projector Kit', type: 'EQUIPMENT', capacity: null },
      { name: 'School Van #2', type: 'VEHICLE', capacity: 12 },
      { name: 'Main Gym', type: 'SPORTS_FIELD', capacity: 500 },
    ]
    for (const rs of resourceSpecs) {
      const resource = await db.resource.create({
        data: {
          clubId: club.id,
          name: rs.name,
          type: rs.type as any,
          description: `Bookable ${rs.type.toLowerCase()} for ${club.name} activities.`,
          location: club.meetingRoom,
          capacity: rs.capacity,
          isBookable: true,
          requiresApproval: rs.type === 'AUDITORIUM' || rs.type === 'VEHICLE',
        },
      })
      // 2-5 bookings per resource
      const members = allMemberships.filter(m => m.clubId === club.id)
      for (let i = 0; i < randomInt(2, 5); i++) {
        const start = new Date(Date.now() + randomInt(-30, 30) * 86400000)
        start.setHours(randomInt(8, 18), 0, 0, 0)
        const end = new Date(start.getTime() + randomInt(1, 4) * 3600000)
        await db.resourceBooking.create({
          data: {
            resourceId: resource.id,
            userId: randomItem(members).userId,
            startTime: start,
            endTime: end,
            purpose: randomItem(['Weekly meeting', 'Special practice', 'Project work', 'Committee session']),
            status: start < new Date() ? 'COMPLETED' : resource.requiresApproval ? randomItem(['PENDING', 'APPROVED']) : 'APPROVED',
          },
        })
      }
    }
  }

  // ============================================================
  // 7) INVENTORY
  // ============================================================
  console.log('Creating inventory...')
  await db.inventoryLoan.deleteMany()
  await db.inventoryItem.deleteMany()
  for (const club of clubs) {
    const invSpecs = [
      { name: 'Club T-Shirt', category: 'uniform', quantity: randomInt(20, 50), condition: 'NEW', price: 15, isLoanable: false },
      { name: 'Projector', category: 'electronic', quantity: 2, condition: 'GOOD', price: 400, isLoanable: true },
      { name: 'Bluetooth Speaker', category: 'electronic', quantity: 3, condition: 'EXCELLENT', price: 80, isLoanable: true },
      { name: 'Camera (DSLR)', category: 'equipment', quantity: 1, condition: 'EXCELLENT', price: 800, isLoanable: true },
      { name: 'Tripod', category: 'equipment', quantity: 4, condition: 'GOOD', price: 60, isLoanable: true },
      { name: 'Whiteboard', category: 'equipment', quantity: 2, condition: 'GOOD', price: 40, isLoanable: false },
      { name: 'Polaroid Camera', category: 'equipment', quantity: 2, condition: 'FAIR', price: 70, isLoanable: true },
      { name: 'Reference Textbook', category: 'book', quantity: 8, condition: 'GOOD', price: 35, isLoanable: true },
    ]
    const items: Array<{ item: Awaited<ReturnType<typeof db.inventoryItem.create>>, loanedOut: number }> = []
    for (const spec of invSpecs) {
      const loanedOut = spec.isLoanable ? randomInt(0, Math.min(spec.quantity, 3)) : 0
      const item = await db.inventoryItem.create({
        data: {
          clubId: club.id,
          name: spec.name,
          category: spec.category,
          quantity: spec.quantity,
          quantityAvailable: spec.quantity - loanedOut,
          condition: spec.condition as any,
          purchasePrice: spec.price,
          currentValue: spec.price * 0.7,
          location: club.meetingRoom,
          isLoanable: spec.isLoanable,
          loanPeriodDays: 7,
          depositAmount: spec.price > 100 ? spec.price * 0.2 : 0,
        },
      })
      items.push({ item, loanedOut })
    }
    // Create loans for loaned-out items
    const members = allMemberships.filter(m => m.clubId === club.id)
    for (const { item, loanedOut } of items) {
      for (let i = 0; i < loanedOut; i++) {
        const checkoutDays = randomInt(2, 14)
        const checkout = new Date(Date.now() - checkoutDays * 86400000)
        const due = new Date(checkout.getTime() + 7 * 86400000)
        const returned = Math.random() < 0.4
        await db.inventoryLoan.create({
          data: {
            itemId: item.id,
            userId: randomItem(members).userId,
            checkoutDate: checkout,
            dueDate: due,
            returnedDate: returned ? new Date(checkout.getTime() + randomInt(1, 7) * 86400000) : null,
            conditionAtCheckout: item.condition,
            conditionAtReturn: returned ? 'GOOD' : null,
            depositCollected: item.depositAmount,
            depositReturned: returned ? item.depositAmount : null,
            status: returned ? 'RETURNED' : due < new Date() ? 'OVERDUE' : 'OUT',
          },
        })
      }
    }
  }

  // ============================================================
  // 8) DOCUMENTS
  // ============================================================
  console.log('Creating documents...')
  await db.document.deleteMany()
  for (const club of clubs) {
    const docSpecs = [
      { title: `${club.name} Bylaws`, category: 'bylaws', desc: 'Official club charter and operating rules.' },
      { title: 'Fall 2025 Meeting Minutes', category: 'minutes', desc: 'Notes from the fall semester weekly meetings.' },
      { title: 'Member Handbook', category: 'handbook', desc: 'Everything a new member needs to know.' },
      { title: 'Spring Trip Permission Slip', category: 'forms', desc: 'Required permission slip for the upcoming field trip.' },
      { title: 'Competition Prep Guide', category: 'other', desc: 'Study materials and strategies for upcoming competitions.' },
    ]
    for (const d of docSpecs) {
      await db.document.create({
        data: {
          clubId: club.id,
          title: d.title,
          description: d.desc,
          category: d.category,
          uploadedById: club.advisorId,
          isPublic: d.category === 'bylaws' || d.category === 'handbook',
          version: 1,
        },
      })
    }
  }

  // ============================================================
  // 9) NOTIFICATIONS
  // ============================================================
  console.log('Creating notifications...')
  await db.notification.deleteMany()
  // Create demo user with specific ID matching the NotificationsBell component
  let demoUser = await db.user.findUnique({ where: { email: 'demo@clubhub.app' } })
  if (!demoUser) {
    demoUser = await db.user.create({
      data: { id: 'demo-user-1', name: 'Demo Admin', email: 'demo@clubhub.app', role: 'SCHOOL_ADMIN' },
    })
  } else if (demoUser.id !== 'demo-user-1') {
    // Update ID to match
    try {
      await db.user.update({ where: { id: demoUser.id }, data: { id: 'demo-user-1' } })
    } catch (e) { /* ignore */ }
  }

  const notifTypes = [
    { type: 'announcement', title: 'New announcement: Welcome back!', body: 'Check the announcements tab for the latest update.' },
    { type: 'event_reminder', title: 'Meeting tomorrow at 3:30 PM', body: 'Don\'t forget about the weekly meeting.' },
    { type: 'task_assigned', title: 'New task: Order supplies', body: 'You\'ve been assigned to order supplies for next meeting.' },
    { type: 'poll_open', title: 'Vote now: T-shirt design', body: 'A new poll is open for voting.' },
    { type: 'volunteer_hours', title: 'Hours approved!', body: 'Your 4 service hours have been approved.' },
    { type: 'badge_earned', title: 'Badge earned: Perfect Attendance', body: 'Congratulations on 10 meetings in a row!' },
    { type: 'application', title: 'New application received', body: 'A student has applied to join your club.' },
    { type: 'inventory', title: 'Equipment overdue', body: 'The camera you borrowed is past due.' },
    { type: 'insight', title: 'AI Insight: At-risk member detected', body: 'A member\'s attendance has dropped. Consider reaching out.' },
  ]
  for (let i = 0; i < 15; i++) {
    const n = randomItem(notifTypes)
    await db.notification.create({
      data: {
        userId: 'demo-user-1',  // matches the NotificationsBell component
        type: n.type,
        title: n.title,
        body: n.body,
        link: '#',
        priority: randomItem(['low', 'normal', 'normal', 'high']),
        isRead: Math.random() < 0.4,
        readAt: Math.random() < 0.4 ? new Date(Date.now() - randomInt(1, 48) * 3600000) : null,
        clubId: randomItem(clubs).id,
      },
    })
  }

  // ============================================================
  // 10) ALUMNI
  // ============================================================
  console.log('Creating alumni profiles...')
  await db.alumniProfile.deleteMany()
  // Convert some 12th graders (graduated) to alumni
  const processedAlumni = new Set<string>()
  for (const club of clubs) {
    const members = allMemberships.filter(m => m.clubId === club.id)
    // Pick some seniors from this club
    const seniorMembers = members.filter(m => m.user.grade === 12)
    for (const m of pickN(seniorMembers, Math.min(3, seniorMembers.length))) {
      if (processedAlumni.has(m.userId)) continue
      processedAlumni.add(m.userId)
      const gradYear = m.user.graduationYear || 2025
      try {
        await db.alumniProfile.create({
        data: {
          userId: m.userId,
          clubId: club.id,
          graduationYear: gradYear - 1,  // already graduated
          college: randomItem(['MIT', 'Stanford', 'Harvard', 'Yale', 'UC Berkeley', 'Princeton', 'Columbia', 'Cornell', 'CMU', 'Caltech']),
          major: randomItem(['Computer Science', 'Mechanical Engineering', 'Biology', 'Economics', 'Political Science', 'Mathematics', 'Physics', 'Psychology']),
          career: randomItem(['Software Engineer', 'Research Assistant', 'Graduate Student', 'Data Analyst', 'Consultant', 'Teacher']),
          employer: randomItem(['Google', 'Microsoft', 'Amazon', 'Startup', 'University Lab', 'Non-profit', null]),
          location: randomItem(['Boston, MA', 'San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX', 'Chicago, IL']),
          linkedin: `https://linkedin.com/in/${m.user.name.toLowerCase().replace(/\s+/g, '-')}`,
          mentorshipAvailable: Math.random() < 0.5,
          mentorshipAreas: Math.random() < 0.5 ? JSON.stringify(['College Applications', 'Career Advice', 'Major Selection']) : null,
          willingToDonate: Math.random() < 0.3,
          willingToSpeak: Math.random() < 0.4,
          newsletter: Math.random() < 0.7,
        },
      })
      } catch (e) { /* skip duplicate */ }
    }
  }

  // ============================================================
  // 11) APPLICATIONS
  // ============================================================
  console.log('Creating applications...')
  await db.clubApplication.deleteMany()
  const applicantNames = ['Jordan Lee', 'Sam Patel', 'Riley Chen', 'Casey Morgan', 'Avery Kim', 'Quinn Brooks', 'Skyler Reyes', 'Drew Anderson']
  for (const club of clubs) {
    for (const name of pickN(applicantNames, randomInt(2, 5))) {
      await db.clubApplication.create({
        data: {
          clubId: club.id,
          name,
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@student.school.edu`,
          grade: randomInt(9, 11),
          studentId: `S${randomInt(20000, 29999)}`,
          phone: `+1${randomInt(200, 999)}${randomInt(200, 999)}${String(randomInt(0, 9999)).padStart(4, '0')}`,
          responses: JSON.stringify({
            'Why do you want to join?': randomItem([
              'I am passionate about this subject and want to grow with like-minded peers.',
              'My friend recommended this club and I attended a meeting as a guest.',
              'I want to develop skills in this area and contribute to the community.',
            ]),
            'Relevant experience': randomItem(['None, but eager to learn!', 'Two years of related coursework', 'Active member of a similar club at my previous school']),
          }),
          status: randomItem(['PENDING', 'PENDING', 'ACCEPTED', 'REJECTED', 'WAITLISTED']),
          createdAt: new Date(Date.now() - randomInt(1, 21) * 86400000),
        },
      })
    }
  }

  // ============================================================
  // 12) AI INSIGHTS — generate initial set
  // ============================================================
  console.log('Pre-generating AI insights...')
  await db.aiInsight.deleteMany()
  for (const club of clubs.slice(0, 3)) {  // only first 3 clubs
    const members = allMemberships.filter(m => m.clubId === club.id)
    if (members.length === 0) continue
    await db.aiInsight.create({
      data: {
        clubId: club.id,
        userId: randomItem(members).userId,
        type: 'AT_RISK_MEMBER',
        severity: 'warning',
        title: `${randomItem(members).user.name} may be at risk of disengaging`,
        body: 'Attendance rate over the last 30 days is 42% (3/7 events attended).',
        recommendation: 'Reach out personally to check in. Consider a 1:1 conversation or assigning them a small task to re-engage.',
        data: JSON.stringify({ rate: 0.42, present: 3, total: 7 }),
      },
    })
    await db.aiInsight.create({
      data: {
        clubId: club.id,
        type: 'RECOMMEND_MEETING_TIME',
        severity: 'info',
        title: `Best-attended meeting slot: ${club.defaultDay} ${club.defaultTime}`,
        body: `${randomInt(40, 80)} check-ins historically occur at this time.`,
        recommendation: `Schedule important meetings at this time for maximum attendance.`,
        data: JSON.stringify({ bestTime: `${club.defaultDay} ${club.defaultTime}` }),
      },
    })
    await db.aiInsight.create({
      data: {
        clubId: club.id,
        type: 'BUDGET_WARNING',
        severity: 'warning',
        title: `Budget "Spring supplies" is 85% spent`,
        body: 'Allocated: $800, Spent: $680.',
        recommendation: 'Review remaining expenses. Consider a fundraiser or reallocate from another budget category.',
      },
    })
  }

  // ============================================================
  // 13) EMAIL TEMPLATES & WEBHOOKS (basic)
  // ============================================================
  console.log('Creating email templates and webhooks...')
  await db.emailTemplate.deleteMany()
  await db.webhook.deleteMany()
  for (const club of clubs.slice(0, 2)) {
    await db.emailTemplate.create({
      data: {
        clubId: club.id,
        name: 'Weekly Meeting Reminder',
        subject: `${club.name} meeting tomorrow at {{time}}`,
        body: `Hi {{name}},\n\nThis is a reminder that ${club.name} meets tomorrow at {{time}} in {{location}}.\n\nSee you there!\n${club.name} Team`,
        type: 'reminder',
      },
    })
    await db.emailTemplate.create({
      data: {
        clubId: club.id,
        name: 'Welcome Email',
        subject: `Welcome to ${club.name}!`,
        body: `Hi {{name}},\n\nWelcome to ${club.name}! We're excited to have you. Our next meeting is {{next_meeting}}.\n\nBest,\n${club.name} Leadership`,
        type: 'welcome',
      },
    })
    await db.webhook.create({
      data: {
        clubId: club.id,
        name: 'Slack #club-announcements',
        url: 'https://example.com/webhook/slack-placeholder',
        events: JSON.stringify(['announcement.created', 'event.created']),
        isActive: true,
      },
    })
  }

  console.log('\n=== Phase 2 seed complete! ===')
  console.log('Clubs with slugs:', await db.club.count({ where: { slug: { not: null } } }))
  console.log('Transactions:', await db.transaction.count())
  console.log('Budgets:', await db.budget.count())
  console.log('Volunteer hours:', await db.volunteerHours.count())
  console.log('Polls:', await db.poll.count())
  console.log('Poll votes:', await db.pollVote.count())
  console.log('Forms:', await db.form.count())
  console.log('Form responses:', await db.formResponse.count())
  console.log('Committees:', await db.committee.count())
  console.log('Tasks:', await db.task.count())
  console.log('Resources:', await db.resource.count())
  console.log('Resource bookings:', await db.resourceBooking.count())
  console.log('Inventory items:', await db.inventoryItem.count())
  console.log('Inventory loans:', await db.inventoryLoan.count())
  console.log('Documents:', await db.document.count())
  console.log('Notifications:', await db.notification.count())
  console.log('Alumni profiles:', await db.alumniProfile.count())
  console.log('Applications:', await db.clubApplication.count())
  console.log('AI insights:', await db.aiInsight.count())
  console.log('Email templates:', await db.emailTemplate.count())
  console.log('Webhooks:', await db.webhook.count())
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
