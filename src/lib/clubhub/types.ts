// Shared types and helpers for Roster — Phase 2 expanded

export interface Club {
  id: string
  name: string
  description: string | null
  category: string
  primaryColor: string
  accentColor: string
  advisorId: string | null
  presidentId: string | null
  meetingRoom: string | null
  defaultDay: string | null
  defaultTime: string | null
  capacity: number
  dues: number
  duesCurrency: string
  isPublic: boolean
  requireApproval: boolean
  status: string
  slug: string | null
  mission: string | null
  coverImage: string | null
  logo: string | null
  foundedYear: number | null
  tags: string | null
  modules: string | null  // JSON string array of enabled module IDs; null = all on (legacy)
  createdAt: string
  updatedAt: string
  advisor?: { id: string, name: string, email: string } | null
  president?: { id: string, name: string } | null
  activeMembers?: number
  attendanceRate?: number
  totalEvents?: number
  totalAnnouncements?: number
}

export interface Member {
  id: string
  userId: string
  clubId: string
  role: string
  joinedAt: string
  leftAt: string | null
  status: string
  customData: string | null
  notes: string | null
  points: number
  streak: number
  longestStreak: number
  user: {
    id: string
    name: string
    email: string
    studentId: string | null
    grade: number | null
    graduationYear: number | null
    house: string | null
    pronouns: string | null
    phone: string | null
    avatar: string | null
    bio: string | null
  }
  club?: { id: string, name: string, primaryColor: string }
  attendanceStats?: Record<string, number>
  attendanceRate?: number
  totalEvents?: number
}

export interface ClubEvent {
  id: string
  clubId: string
  title: string
  description: string | null
  type: string
  startTime: string
  endTime: string
  location: string | null
  capacity: number | null
  isRequired: boolean
  isRecurring: boolean
  recurrence: string | null
  status: string
  creatorId: string | null
  meetingLink: string | null
  coverImage: string | null
  isLivestreamed: boolean
  agenda: string | null
  createdAt: string
  club?: { id: string, name: string, primaryColor: string }
  attendanceStats?: Record<string, number>
  _count?: { attendances: number, checkIns: number, rsvps: number }
}

export interface AttendanceRecord {
  id: string
  eventId: string
  userId: string
  status: string
  method: string | null
  checkInTime: string | null
  checkOutTime: string | null
  notes: string | null
  excusedBy: string | null
  excusedReason: string | null
  pointsEarned: number
  durationMinutes: number | null
  user: { id: string, name: string, email: string, studentId: string | null, grade: number | null, avatar: string | null }
  event?: { id: string, title: string, startTime: string, type: string, club: { id: string, name: string, primaryColor: string } }
}

export interface Badge {
  id: string
  clubId: string
  name: string
  description: string | null
  icon: string
  color: string
  tier: string
  points: number
  _count?: { userBadges: number }
}

export interface Announcement {
  id: string
  clubId: string
  authorId: string
  title: string
  content: string
  priority: string
  category: string | null
  isPinned: boolean
  sendEmail: boolean
  sendSMS: boolean
  scheduledFor: string | null
  expiresAt: string | null
  createdAt: string
  author?: { id: string, name: string, email: string, avatar: string | null }
  club?: { id: string, name: string, primaryColor: string }
  _count?: { reads: number }
}

export interface CustomField {
  id: string
  clubId: string | null
  formId: string | null
  name: string
  label: string
  type: string
  options: string | null
  required: boolean
  defaultValue: string | null
  description: string | null
  sortOrder: number
  isVisible: boolean
  isEditable: boolean
  appliesTo: string
}

export interface AuditLog {
  id: string
  userId: string | null
  action: string
  entity: string
  entityId: string | null
  clubId: string | null
  before: string | null
  after: string | null
  ipAddress: string | null
  userAgent: string | null
  timestamp: string
  user?: { id: string, name: string, email: string, avatar: string | null } | null
}

export interface ClubSettings {
  clubId: string
  attendanceWindowBefore: number
  attendanceWindowAfter: number
  enableQrCheckin: boolean
  enableKioskMode: boolean
  enableSelfCheckin: boolean
  enableGeofencing: boolean
  enableSelfieVerify: boolean
  enableGamification: boolean
  enableStreaks: boolean
  enableLeaderboard: boolean
  enableParentPortal: boolean
  requireExcuseNote: boolean
  autoMarkNoShow: boolean
  noShowThresholdMinutes: number
  defaultAttendanceStatus: string
  enableVolunteerHours: boolean
  enableDuesTracking: boolean
  emailRemindersEnabled: boolean
  smsRemindersEnabled: boolean
  reminderHoursBefore: number
  customCss: string | null
  enableRsvp: boolean
  enablePublicPortal: boolean
  enableApplications: boolean
  enableAlumniTracking: boolean
  enableAiInsights: boolean
  enableInventory: boolean
  enableResources: boolean
  enableForms: boolean
  enablePolls: boolean
  enableTasks: boolean
  enableFinance: boolean
  enableDocuments: boolean
  enableCommittees: boolean
  enableCalendarSync: boolean
  timezone: string
  motto: string | null
}

// ===================== PHASE 2 TYPES =====================

export interface Transaction {
  id: string
  clubId: string
  type: string
  category: string
  amount: number
  description: string | null
  date: string
  recordedById: string | null
  memberId: string | null
  eventId: string | null
  receiptUrl: string | null
  status: string
  paymentMethod: string | null
  checkNumber: string | null
  recordedBy?: { id: string, name: string } | null
  member?: { id: string, user: { id: string, name: string } } | null
}

export interface Budget {
  id: string
  clubId: string
  name: string
  category: string
  allocated: number
  spent: number
  startDate: string
  endDate: string | null
  notes: string | null
}

export interface VolunteerHours {
  id: string
  clubId: string
  userId: string
  eventId: string | null
  hours: number
  date: string
  description: string
  organization: string | null
  location: string | null
  supervisor: string | null
  status: string
  approvedById: string | null
  approvedAt: string | null
  rejectedReason: string | null
  evidence: string | null
  user?: { id: string, name: string, email: string, grade: number | null }
  event?: { id: string, title: string } | null
}

export interface Poll {
  id: string
  clubId: string
  title: string
  description: string | null
  type: string
  status: string
  allowMultiple: boolean
  allowAnonymous: boolean
  showResults: boolean
  startDate: string
  endDate: string
  isOfficial: boolean
  eventId: string | null
  eligibility: string | null
  options?: PollOption[]
  _count?: { votes: number }
  userVoted?: boolean
}

export interface PollOption {
  id: string
  pollId: string
  text: string
  description: string | null
  color: string | null
  imageUrl: string | null
  candidateUserId: string | null
  sortOrder: number
  _count?: { votes: number }
  voteShare?: number
}

export interface FormDef {
  id: string
  clubId: string
  title: string
  description: string | null
  type: string
  status: string
  isAnonymous: boolean
  allowMultipleResponses: boolean
  deadline: string | null
  eventId: string | null
  collectName: boolean
  successMessage: string | null
  fields?: CustomField[]
  _count?: { responses: number }
}

export interface FormResponse {
  id: string
  formId: string
  userId: string | null
  data: string
  submittedAt: string
  user?: { id: string, name: string, email: string } | null
}

export interface TaskList {
  id: string
  clubId: string
  name: string
  color: string
  sortOrder: number
  isArchived: boolean
  tasks?: Task[]
}

export interface Task {
  id: string
  clubId: string
  listId: string | null
  title: string
  description: string | null
  status: string
  priority: string
  assigneeId: string | null
  creatorId: string | null
  committeeId: string | null
  eventId: string | null
  dueDate: string | null
  estimatedMinutes: number | null
  actualMinutes: number | null
  tags: string | null
  checklist: string | null
  attachments: string | null
  sortOrder: number
  completedAt: string | null
  createdAt: string
  assignee?: { id: string, name: string, avatar: string | null } | null
  creator?: { id: string, name: string } | null
  committee?: { id: string, name: string, color: string } | null
  list?: { id: string, name: string, color: string } | null
}

export interface Committee {
  id: string
  clubId: string
  name: string
  description: string | null
  leadId: string | null
  color: string
  parentId: string | null
  lead?: { id: string, name: string } | null
  members?: { id: string, userId: string, role: string, user: { id: string, name: string } }[]
  _count?: { tasks: number }
}

export interface Resource {
  id: string
  clubId: string
  name: string
  type: string
  description: string | null
  location: string | null
  capacity: number | null
  imageUrl: string | null
  isBookable: boolean
  bookingWindowDays: number
  maxBookingHours: number
  requiresApproval: boolean
  tags: string | null
  bookings?: ResourceBooking[]
  _count?: { bookings: number }
}

export interface ResourceBooking {
  id: string
  resourceId: string
  userId: string
  eventId: string | null
  startTime: string
  endTime: string
  purpose: string | null
  status: string
  approvedById: string | null
  approvedAt: string | null
  notes: string | null
  user?: { id: string, name: string }
  resource?: { id: string, name: string, type: string }
}

export interface InventoryItem {
  id: string
  clubId: string
  name: string
  description: string | null
  category: string
  sku: string | null
  serialNumber: string | null
  quantity: number
  quantityAvailable: number
  condition: string
  purchaseDate: string | null
  purchasePrice: number | null
  currentValue: number | null
  location: string | null
  imageUrl: string | null
  notes: string | null
  isLoanable: boolean
  loanPeriodDays: number
  depositAmount: number
  _count?: { loans: number }
}

export interface InventoryLoan {
  id: string
  itemId: string
  userId: string
  checkoutDate: string
  dueDate: string
  returnedDate: string | null
  conditionAtCheckout: string | null
  conditionAtReturn: string | null
  depositCollected: number
  depositReturned: number | null
  notes: string | null
  status: string
  item?: { id: string, name: string, category: string }
  user?: { id: string, name: string, email: string }
}

export interface Document {
  id: string
  clubId: string
  title: string
  description: string | null
  category: string
  fileUrl: string | null
  fileType: string | null
  fileSize: number | null
  version: number
  uploadedById: string | null
  tags: string | null
  isPublic: boolean
  viewCount: number
  createdAt: string
  updatedAt: string
  uploadedBy?: { id: string, name: string } | null
}

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  body: string | null
  link: string | null
  priority: string
  isRead: boolean
  readAt: string | null
  metadata: string | null
  clubId: string | null
  createdAt: string
}

export interface AlumniProfile {
  id: string
  userId: string
  clubId: string | null
  graduationYear: number
  college: string | null
  major: string | null
  career: string | null
  employer: string | null
  location: string | null
  linkedin: string | null
  mentorshipAvailable: boolean
  mentorshipAreas: string | null
  willingToDonate: boolean
  willingToSpeak: boolean
  newsletter: boolean
  notes: string | null
  user?: { id: string, name: string, email: string, avatar: string | null }
  club?: { id: string, name: string } | null
}

export interface ClubApplication {
  id: string
  clubId: string
  userId: string | null
  name: string
  email: string
  grade: number | null
  studentId: string | null
  phone: string | null
  responses: string
  status: string
  reviewedById: string | null
  reviewedAt: string | null
  reviewNotes: string | null
  rejectionReason: string | null
  invitedToJoin: boolean
  createdAt: string
  club?: { id: string, name: string, primaryColor: string }
}

export interface AiInsight {
  id: string
  clubId: string | null
  userId: string | null
  type: string
  severity: string
  title: string
  body: string
  recommendation: string | null
  data: string | null
  isResolved: boolean
  resolvedAt: string | null
  createdAt: string
  user?: { id: string, name: string } | null
}

export interface EventRSVP {
  id: string
  eventId: string
  userId: string
  status: string
  partySize: number
  notes: string | null
  createdAt: string
  user?: { id: string, name: string, email: string }
}

// ===================== CONSTANTS =====================

export const CLUB_CATEGORIES: { value: string, label: string, emoji: string }[] = [
  { value: 'ACADEMIC', label: 'Academic', emoji: '📚' },
  { value: 'ARTS', label: 'Arts', emoji: '🎨' },
  { value: 'ATHLETIC', label: 'Athletic', emoji: '⚽' },
  { value: 'SERVICE', label: 'Service', emoji: '🤝' },
  { value: 'STEM', label: 'STEM', emoji: '🔬' },
  { value: 'CULTURAL', label: 'Cultural', emoji: '🌍' },
  { value: 'GOVERNMENT', label: 'Government', emoji: '🏛️' },
  { value: 'HOBBY', label: 'Hobby', emoji: '🎯' },
  { value: 'PROFESSIONAL', label: 'Professional', emoji: '💼' },
  { value: 'OTHER', label: 'Other', emoji: '✨' },
]

export const EVENT_TYPES: { value: string, label: string, emoji: string }[] = [
  { value: 'MEETING', label: 'Meeting', emoji: '👥' },
  { value: 'PRACTICE', label: 'Practice', emoji: '🏋️' },
  { value: 'REHEARSAL', label: 'Rehearsal', emoji: '🎭' },
  { value: 'COMPETITION', label: 'Competition', emoji: '🏆' },
  { value: 'FUNDRAISER', label: 'Fundraiser', emoji: '💰' },
  { value: 'FIELD_TRIP', label: 'Field Trip', emoji: '🚌' },
  { value: 'WORKSHOP', label: 'Workshop', emoji: '🛠️' },
  { value: 'SOCIAL', label: 'Social', emoji: '🎉' },
  { value: 'ELECTION', label: 'Election', emoji: '🗳️' },
  { value: 'VOLUNTEER', label: 'Volunteer', emoji: '🌱' },
  { value: 'STUDY_SESSION', label: 'Study Session', emoji: '📖' },
  { value: 'PERFORMANCE', label: 'Performance', emoji: '🎤' },
  { value: 'OTHER', label: 'Other', emoji: '📅' },
]

export const ATTENDANCE_STATUSES: { value: string, label: string, color: string, emoji: string }[] = [
  { value: 'PRESENT', label: 'Present', color: '#10b981', emoji: '✅' },
  { value: 'LATE', label: 'Late', color: '#f59e0b', emoji: '⏰' },
  { value: 'ABSENT', label: 'Absent', color: '#ef4444', emoji: '❌' },
  { value: 'EXCUSED', label: 'Excused', color: '#3b82f6', emoji: '📝' },
  { value: 'VIRTUAL', label: 'Virtual', color: '#8b5cf6', emoji: '💻' },
  { value: 'PARTIAL', label: 'Partial', color: '#06b6d4', emoji: '🌗' },
  { value: 'NO_SHOW', label: 'No Show', color: '#dc2626', emoji: '🚫' },
  { value: 'PENDING', label: 'Pending', color: '#6b7280', emoji: '⏳' },
]

export const CHECKIN_METHODS: { value: string, label: string, emoji: string }[] = [
  { value: 'QR_CODE', label: 'QR Code', emoji: '📱' },
  { value: 'KIOSK', label: 'Kiosk', emoji: '🖥️' },
  { value: 'MANUAL', label: 'Manual', emoji: '✍️' },
  { value: 'SELF_CHECKIN', label: 'Self Check-in', emoji: '🙋' },
  { value: 'GEOFENCED', label: 'Geofenced', emoji: '📍' },
  { value: 'SELFIE', label: 'Selfie', emoji: '🤳' },
  { value: 'ADVISOR_MARK', label: 'Advisor Mark', emoji: '👨‍🏫' },
  { value: 'BULK_IMPORT', label: 'Bulk Import', emoji: '📥' },
  { value: 'NFC', label: 'NFC Tap', emoji: '📶' },
  { value: 'BLUETOOTH_BEACON', label: 'Bluetooth Beacon', emoji: '📡' },
  { value: 'BIOMETRIC', label: 'Biometric', emoji: '🔍' },
]

export const MEMBERSHIP_ROLES: { value: string, label: string }[] = [
  { value: 'PRESIDENT', label: 'President' },
  { value: 'VICE_PRESIDENT', label: 'Vice President' },
  { value: 'SECRETARY', label: 'Secretary' },
  { value: 'TREASURER', label: 'Treasurer' },
  { value: 'COMMITTEE_HEAD', label: 'Committee Head' },
  { value: 'MEMBER', label: 'Member' },
  { value: 'PROBATIONARY', label: 'Probationary' },
]

export const FIELD_TYPES: { value: string, label: string, icon: string }[] = [
  { value: 'TEXT', label: 'Text', icon: 'Aa' },
  { value: 'TEXTAREA', label: 'Long Text', icon: '¶' },
  { value: 'NUMBER', label: 'Number', icon: '#' },
  { value: 'DATE', label: 'Date', icon: '📅' },
  { value: 'SELECT', label: 'Dropdown', icon: '▽' },
  { value: 'MULTISELECT', label: 'Multi-Select', icon: '☑' },
  { value: 'RADIO', label: 'Radio', icon: '◉' },
  { value: 'CHECKBOX', label: 'Checkbox', icon: '☒' },
  { value: 'EMAIL', label: 'Email', icon: '✉' },
  { value: 'PHONE', label: 'Phone', icon: '☎' },
  { value: 'URL', label: 'URL', icon: '🔗' },
  { value: 'TSHIRT_SIZE', label: 'T-Shirt Size', icon: '👕' },
  { value: 'EMERGENCY_CONTACT', label: 'Emergency Contact', icon: '🚨' },
  { value: 'RATING', label: 'Star Rating', icon: '⭐' },
  { value: 'FILE', label: 'File Upload', icon: '📎' },
  { value: 'SIGNATURE', label: 'Signature', icon: '✒' },
]

export const ANNOUNCEMENT_PRIORITIES: { value: string, label: string, color: string }[] = [
  { value: 'LOW', label: 'Low', color: '#6b7280' },
  { value: 'NORMAL', label: 'Normal', color: '#3b82f6' },
  { value: 'HIGH', label: 'High', color: '#f59e0b' },
  { value: 'URGENT', label: 'Urgent', color: '#ef4444' },
]

export const BADGE_TIERS: { value: string, label: string, color: string }[] = [
  { value: 'BRONZE', label: 'Bronze', color: '#cd7f32' },
  { value: 'SILVER', label: 'Silver', color: '#c0c0c0' },
  { value: 'GOLD', label: 'Gold', color: '#ffd700' },
  { value: 'PLATINUM', label: 'Platinum', color: '#e5e4e2' },
  { value: 'DIAMOND', label: 'Diamond', color: '#b9f2ff' },
]

// Phase 2 constants
export const TRANSACTION_TYPES: { value: string, label: string, color: string }[] = [
  { value: 'INCOME', label: 'Income', color: '#10b981' },
  { value: 'EXPENSE', label: 'Expense', color: '#ef4444' },
  { value: 'DUE_PAYMENT', label: 'Dues Payment', color: '#3b82f6' },
  { value: 'REFUND', label: 'Refund', color: '#f59e0b' },
  { value: 'ADJUSTMENT', label: 'Adjustment', color: '#8b5cf6' },
]

export const TRANSACTION_CATEGORIES: { value: string, label: string, emoji: string }[] = [
  { value: 'dues', label: 'Dues', emoji: '💳' },
  { value: 'supplies', label: 'Supplies', emoji: '📦' },
  { value: 'fundraiser', label: 'Fundraiser', emoji: '💰' },
  { value: 'equipment', label: 'Equipment', emoji: '⚽' },
  { value: 'travel', label: 'Travel', emoji: '🚌' },
  { value: 'food', label: 'Food', emoji: '🍕' },
  { value: 'prize', label: 'Prizes', emoji: '🎁' },
  { value: 'venue', label: 'Venue', emoji: '🏛️' },
  { value: 'marketing', label: 'Marketing', emoji: '📣' },
  { value: 'other', label: 'Other', emoji: '✨' },
]

export const PAYMENT_METHODS: { value: string, label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'card', label: 'Card' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'cashapp', label: 'Cash App' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'other', label: 'Other' },
]

export const POLL_TYPES: { value: string, label: string, icon: string }[] = [
  { value: 'SINGLE_CHOICE', label: 'Single Choice', icon: '◉' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice', icon: '☑' },
  { value: 'RANKED_CHOICE', label: 'Ranked Choice', icon: '🔢' },
  { value: 'APPROVAL', label: 'Approval', icon: '✓' },
  { value: 'YES_NO', label: 'Yes/No', icon: '👍' },
  { value: 'LIKERT', label: 'Likert Scale', icon: '📊' },
]

export const FORM_TYPES: { value: string, label: string, icon: string }[] = [
  { value: 'SURVEY', label: 'Survey', icon: '📋' },
  { value: 'FEEDBACK', label: 'Feedback', icon: '💬' },
  { value: 'RSVP', label: 'RSVP', icon: '✓' },
  { value: 'SIGNUP', label: 'Signup Sheet', icon: '📝' },
  { value: 'APPLICATION', label: 'Application', icon: '📨' },
  { value: 'NOMINATION', label: 'Nomination', icon: '🗳️' },
  { value: 'TSHIRT_ORDER', label: 'T-Shirt Order', icon: '👕' },
  { value: 'PERMISSION_SLIP', label: 'Permission Slip', icon: '✍️' },
  { value: 'ASSESSMENT', label: 'Assessment', icon: '✅' },
  { value: 'CUSTOM', label: 'Custom', icon: '⚙️' },
]

export const TASK_STATUSES: { value: string, label: string, color: string }[] = [
  { value: 'TODO', label: 'To Do', color: '#6b7280' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: '#3b82f6' },
  { value: 'IN_REVIEW', label: 'In Review', color: '#f59e0b' },
  { value: 'BLOCKED', label: 'Blocked', color: '#ef4444' },
  { value: 'DONE', label: 'Done', color: '#10b981' },
  { value: 'CANCELLED', label: 'Cancelled', color: '#9ca3af' },
]

export const TASK_PRIORITIES: { value: string, label: string, color: string }[] = [
  { value: 'LOW', label: 'Low', color: '#6b7280' },
  { value: 'MEDIUM', label: 'Medium', color: '#3b82f6' },
  { value: 'HIGH', label: 'High', color: '#f59e0b' },
  { value: 'URGENT', label: 'Urgent', color: '#ef4444' },
]

export const RESOURCE_TYPES: { value: string, label: string, emoji: string }[] = [
  { value: 'ROOM', label: 'Room', emoji: '🚪' },
  { value: 'VEHICLE', label: 'Vehicle', emoji: '🚐' },
  { value: 'EQUIPMENT', label: 'Equipment', emoji: '🎤' },
  { value: 'SPORTS_FIELD', label: 'Sports Field', emoji: '⚽' },
  { value: 'AUDITORIUM', label: 'Auditorium', emoji: '🎭' },
  { value: 'LAB', label: 'Lab', emoji: '🧪' },
  { value: 'KITCHEN', label: 'Kitchen', emoji: '🍳' },
  { value: 'OUTDOOR_SPACE', label: 'Outdoor Space', emoji: '🌳' },
  { value: 'OTHER', label: 'Other', emoji: '📦' },
]

export const ITEM_CONDITIONS: { value: string, label: string, color: string }[] = [
  { value: 'NEW', label: 'New', color: '#10b981' },
  { value: 'EXCELLENT', label: 'Excellent', color: '#3b82f6' },
  { value: 'GOOD', label: 'Good', color: '#8b5cf6' },
  { value: 'FAIR', label: 'Fair', color: '#f59e0b' },
  { value: 'POOR', label: 'Poor', color: '#ef4444' },
  { value: 'BROKEN', label: 'Broken', color: '#dc2626' },
  { value: 'LOST', label: 'Lost', color: '#6b7280' },
]

export const INVENTORY_CATEGORIES: { value: string, label: string, emoji: string }[] = [
  { value: 'equipment', label: 'Equipment', emoji: '🎮' },
  { value: 'uniform', label: 'Uniform', emoji: '👕' },
  { value: 'instrument', label: 'Instrument', emoji: '🎻' },
  { value: 'book', label: 'Book', emoji: '📚' },
  { value: 'tool', label: 'Tool', emoji: '🔧' },
  { value: 'electronic', label: 'Electronic', emoji: '💻' },
  { value: 'decor', label: 'Decoration', emoji: '🎨' },
  { value: 'other', label: 'Other', emoji: '📦' },
]

export const LOAN_STATUSES: { value: string, label: string, color: string }[] = [
  { value: 'OUT', label: 'Checked Out', color: '#3b82f6' },
  { value: 'RETURNED', label: 'Returned', color: '#10b981' },
  { value: 'OVERDUE', label: 'Overdue', color: '#ef4444' },
  { value: 'LOST', label: 'Lost', color: '#dc2626' },
  { value: 'DAMAGED', label: 'Damaged', color: '#f59e0b' },
]

export const BOOKING_STATUSES: { value: string, label: string, color: string }[] = [
  { value: 'PENDING', label: 'Pending', color: '#f59e0b' },
  { value: 'APPROVED', label: 'Approved', color: '#10b981' },
  { value: 'REJECTED', label: 'Rejected', color: '#ef4444' },
  { value: 'CANCELLED', label: 'Cancelled', color: '#6b7280' },
  { value: 'COMPLETED', label: 'Completed', color: '#3b82f6' },
]

export const RSVP_STATUSES: { value: string, label: string, color: string, emoji: string }[] = [
  { value: 'GOING', label: 'Going', color: '#10b981', emoji: '✓' },
  { value: 'MAYBE', label: 'Maybe', color: '#f59e0b', emoji: '?' },
  { value: 'NOT_GOING', label: 'Not Going', color: '#ef4444', emoji: '✗' },
  { value: 'WAITLIST', label: 'Waitlist', color: '#8b5cf6', emoji: '⏳' },
]

export const APPLICATION_STATUSES: { value: string, label: string, color: string }[] = [
  { value: 'PENDING', label: 'Pending', color: '#6b7280' },
  { value: 'REVIEWING', label: 'Reviewing', color: '#3b82f6' },
  { value: 'ACCEPTED', label: 'Accepted', color: '#10b981' },
  { value: 'REJECTED', label: 'Rejected', color: '#ef4444' },
  { value: 'WAITLISTED', label: 'Waitlisted', color: '#f59e0b' },
  { value: 'INVITED', label: 'Invited', color: '#8b5cf6' },
]

export const INSIGHT_TYPES: { value: string, label: string, icon: string }[] = [
  { value: 'AT_RISK_MEMBER', label: 'At-Risk Member', icon: '⚠️' },
  { value: 'ATTENDANCE_DECLINE', label: 'Attendance Decline', icon: '📉' },
  { value: 'ENGAGEMENT_DROP', label: 'Engagement Drop', icon: '💤' },
  { value: 'SCHEDULING_CONFLICT', label: 'Scheduling Conflict', icon: '📅' },
  { value: 'BUDGET_WARNING', label: 'Budget Warning', icon: '💰' },
  { value: 'EQUIPMENT_OVERDUE', label: 'Equipment Overdue', icon: '📦' },
  { value: 'RECOMMEND_MEETING_TIME', label: 'Best Meeting Time', icon: '🕐' },
  { value: 'RECOMMEND_OUTREACH', label: 'Outreach Suggestion', icon: '📣' },
  { value: 'CAPACITY_WARNING', label: 'Capacity Warning', icon: '🚨' },
  { value: 'TREND_DETECTION', label: 'Trend Detected', icon: '📊' },
]

export const NOTIFICATION_TYPES: { value: string, label: string, icon: string }[] = [
  { value: 'announcement', label: 'Announcement', icon: '📢' },
  { value: 'event_reminder', label: 'Event Reminder', icon: '⏰' },
  { value: 'task_assigned', label: 'Task Assigned', icon: '✅' },
  { value: 'rsvp_update', label: 'RSVP Update', icon: '📅' },
  { value: 'poll_open', label: 'Poll Opened', icon: '🗳️' },
  { value: 'volunteer_hours', label: 'Volunteer Hours', icon: '🌱' },
  { value: 'badge_earned', label: 'Badge Earned', icon: '🏆' },
  { value: 'application', label: 'Application', icon: '📨' },
  { value: 'inventory', label: 'Inventory', icon: '📦' },
  { value: 'resource', label: 'Resource', icon: '🎨' },
  { value: 'insight', label: 'AI Insight', icon: '🤖' },
]

// ===================== HELPERS =====================

export function statusColor(status: string): string {
  return ATTENDANCE_STATUSES.find(s => s.value === status)?.color || '#6b7280'
}

export function statusEmoji(status: string): string {
  return ATTENDANCE_STATUSES.find(s => s.value === status)?.emoji || '⏳'
}

export function statusLabel(status: string): string {
  return ATTENDANCE_STATUSES.find(s => s.value === status)?.label || status
}

export function categoryEmoji(cat: string): string {
  return CLUB_CATEGORIES.find(c => c.value === cat)?.emoji || '✨'
}

export function categoryLabel(cat: string): string {
  return CLUB_CATEGORIES.find(c => c.value === cat)?.label || cat
}

export function eventTypeEmoji(type: string): string {
  return EVENT_TYPES.find(e => e.value === type)?.emoji || '📅'
}

export function eventTypeLabel(type: string): string {
  return EVENT_TYPES.find(e => e.value === type)?.label || type
}

export function taskStatusLabel(status: string): string {
  return TASK_STATUSES.find(s => s.value === status)?.label || status
}
export function taskStatusColor(status: string): string {
  return TASK_STATUSES.find(s => s.value === status)?.color || '#6b7280'
}
export function taskPriorityLabel(p: string): string {
  return TASK_PRIORITIES.find(s => s.value === p)?.label || p
}
export function taskPriorityColor(p: string): string {
  return TASK_PRIORITIES.find(s => s.value === p)?.color || '#6b7280'
}

export function resourceTypeEmoji(t: string): string {
  return RESOURCE_TYPES.find(r => r.value === t)?.emoji || '📦'
}
export function resourceTypeLabel(t: string): string {
  return RESOURCE_TYPES.find(r => r.value === t)?.label || t
}

export function itemConditionLabel(c: string): string {
  return ITEM_CONDITIONS.find(s => s.value === c)?.label || c
}
export function itemConditionColor(c: string): string {
  return ITEM_CONDITIONS.find(s => s.value === c)?.color || '#6b7280'
}

export function inventoryCategoryEmoji(c: string): string {
  return INVENTORY_CATEGORIES.find(s => s.value === c)?.emoji || '📦'
}

export function loanStatusLabel(s: string): string {
  return LOAN_STATUSES.find(x => x.value === s)?.label || s
}
export function loanStatusColor(s: string): string {
  return LOAN_STATUSES.find(x => x.value === s)?.color || '#6b7280'
}

export function bookingStatusLabel(s: string): string {
  return BOOKING_STATUSES.find(x => x.value === s)?.label || s
}
export function bookingStatusColor(s: string): string {
  return BOOKING_STATUSES.find(x => x.value === s)?.color || '#6b7280'
}

export function rsvpLabel(s: string): string {
  return RSVP_STATUSES.find(x => x.value === s)?.label || s
}
export function rsvpColor(s: string): string {
  return RSVP_STATUSES.find(x => x.value === s)?.color || '#6b7280'
}
export function rsvpEmoji(s: string): string {
  return RSVP_STATUSES.find(x => x.value === s)?.emoji || '?'
}

export function applicationStatusLabel(s: string): string {
  return APPLICATION_STATUSES.find(x => x.value === s)?.label || s
}
export function applicationStatusColor(s: string): string {
  return APPLICATION_STATUSES.find(x => x.value === s)?.color || '#6b7280'
}

export function transactionTypeLabel(t: string): string {
  return TRANSACTION_TYPES.find(x => x.value === t)?.label || t
}
export function transactionTypeColor(t: string): string {
  return TRANSACTION_TYPES.find(x => x.value === t)?.color || '#6b7280'
}
export function transactionCategoryEmoji(c: string): string {
  return TRANSACTION_CATEGORIES.find(x => x.value === c)?.emoji || '💸'
}

export function insightTypeLabel(t: string): string {
  return INSIGHT_TYPES.find(x => x.value === t)?.label || t
}
export function insightTypeIcon(t: string): string {
  return INSIGHT_TYPES.find(x => x.value === t)?.icon || '💡'
}

export function pollTypeLabel(t: string): string {
  return POLL_TYPES.find(x => x.value === t)?.label || t
}
export function formTypeLabel(t: string): string {
  return FORM_TYPES.find(x => x.value === t)?.label || t
}
export function formTypeIcon(t: string): string {
  return FORM_TYPES.find(x => x.value === t)?.icon || '📋'
}

export function formatDate(d: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function formatTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function timeAgo(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return formatDate(date)
}

export function initials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export function avatarColor(name: string): string {
  const colors = ['#10b981', '#6366f1', '#ec4899', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function formatHours(hours: number): string {
  if (hours === 0) return '0h'
  const whole = Math.floor(hours)
  const minutes = Math.round((hours - whole) * 60)
  if (minutes === 0) return `${whole}h`
  return `${whole}h ${minutes}m`
}

export function parseJSON<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try { return JSON.parse(s) as T } catch { return fallback }
}
