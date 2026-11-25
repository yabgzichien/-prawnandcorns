// ALL DATA INVENTED FOR THE DEMO — not real XMUM fees, clubs or records.

export type Club = {
  id: string;
  name: string;
  category: "Tech" | "Sports" | "Arts" | "Service" | "Culture";
  blurb: string;
  meets: string;
  room?: string;
  members: number;
  recruiting: boolean;
  tags: string[];
};

export const CLUBS: Club[] = [
  { id: "robo", name: "Robotics & AI Society", category: "Tech", blurb: "Build line-followers, train small models, enter regional contests.", meets: "Wed 19:00", room: "A5-L3", members: 64, recruiting: true, tags: ["robotics", "ai", "coding", "engineering", "hardware"] },
  { id: "code", name: "Coding Guild", category: "Tech", blurb: "Weekly algorithm nights and a hack-day every semester.", meets: "Tue 20:00", room: "A4-301", members: 112, recruiting: true, tags: ["coding", "programming", "algorithms", "hackathon", "web"] },
  { id: "photo", name: "Photography Club", category: "Arts", blurb: "Sunrise lake walks, edit workshops and a campus exhibition.", meets: "Sat 08:00", room: "Lakefront Café", members: 48, recruiting: true, tags: ["photography", "art", "creative", "outdoors", "film"] },
  { id: "basket", name: "Basketball Club", category: "Sports", blurb: "Friendly games and inter-faculty league. All levels welcome.", meets: "Thu 17:30", room: "Outdoor Courts", members: 86, recruiting: true, tags: ["basketball", "sports", "fitness", "team"] },
  { id: "badm", name: "Badminton Club", category: "Sports", blurb: "Social doubles every week; beginners get a coach for the first month.", meets: "Mon 18:30", room: "B1 Hall", members: 73, recruiting: false, tags: ["badminton", "sports", "fitness"] },
  { id: "calli", name: "Chinese Calligraphy Society", category: "Culture", blurb: "Brush, ink and a slow hour away from screens.", meets: "Fri 16:00", room: "A2-104", members: 29, recruiting: true, tags: ["calligraphy", "chinese", "culture", "art", "calm"] },
  { id: "debate", name: "Debate Society", category: "Culture", blurb: "Parliamentary-style debates, English and Mandarin sessions.", meets: "Tue 18:30", room: "A3-201", members: 41, recruiting: true, tags: ["debate", "speaking", "english", "public speaking", "leadership"] },
  { id: "volun", name: "Volunteer Corps", category: "Service", blurb: "Beach clean-ups, tutoring and community drives around Sepang.", meets: "Sun 09:00", members: 95, recruiting: true, tags: ["volunteer", "community", "service", "outdoors"] },
  { id: "band", name: "Music & Band Club", category: "Arts", blurb: "Jam room, open-mic nights and the end-of-semester showcase.", meets: "Fri 19:30", room: "B1 Hall", members: 57, recruiting: true, tags: ["music", "band", "guitar", "singing", "creative"] },
];

export type EventItem = { id: string; title: string; when: string; where: string; clubId?: string; room?: string };
export const EVENTS: EventItem[] = [
  { id: "e1", title: "Club Fair", when: "Fri 27 Nov, 15:00", where: "Lakeside Walk", room: "Lakefront Café" },
  { id: "e2", title: "Hack-day: Build in 6 hours", when: "Sat 28 Nov, 09:00", where: "A4-301", clubId: "code", room: "A4-301" },
  { id: "e3", title: "Open-mic night", when: "Fri 4 Dec, 19:30", where: "B1 Hall", clubId: "band", room: "B1 Hall" },
];

export type Dues = { id: string; label: string; amount: number; due: string; status: "paid" | "upcoming" | "later"; paidOn?: string };

export const FINANCE = {
  currency: "RM",
  tuitionTotal: 8700,
  paid: 4350,
  dues: [
    { id: "f1", label: "Tuition instalment 1", amount: 4350, due: "2026-09-15T00:00:00+08:00", status: "paid", paidOn: "2026-09-12T00:00:00+08:00" },
    { id: "f2", label: "Tuition instalment 2", amount: 4350, due: "2026-11-30T00:00:00+08:00", status: "upcoming" },
    { id: "f3", label: "Hostel for Semester 1", amount: 1200, due: "2026-12-15T00:00:00+08:00", status: "later" },
  ] as Dues[],
  history: [
    { id: "p1", label: "Tuition instalment 1", amount: 4350, date: "12 Sep 2026", method: "Online banking" },
    { id: "p2", label: "Registration fee", amount: 300, date: "28 Aug 2026", method: "Card" },
  ],
};

export type Department = {
  id: string;
  name: string;
  email: string;
  handles: string;
  keywords: string[];
};

// Email addresses are the public ones listed in the competition handbook.
export const DEPARTMENTS: Department[] = [
  { id: "finance", name: "Finance Office", email: "finance@xmu.edu.my", handles: "Fees, instalments, receipts, refunds", keywords: ["fee", "fees", "instalment", "installment", "payment", "pay", "receipt", "refund", "invoice", "tuition", "owe", "finance"] },
  { id: "aao", name: "Academic Affairs Office", email: "xmumac@xmu.edu.my", handles: "Timetable, course registration, add/drop, class changes", keywords: ["timetable", "class", "course", "add", "drop", "registration", "clash", "cancel", "replacement", "makeup", "make-up", "lecture", "tutorial", "module"] },
  { id: "exam", name: "Exam Unit", email: "xmumexam.degree@xmu.edu.my", handles: "Exam schedules, clashes, deferrals, results", keywords: ["exam", "exams", "test", "defer", "deferral", "result", "results", "midterm", "final"] },
  { id: "accom", name: "Accommodation Office", email: "studentaccommodation@xmu.edu.my", handles: "Hostel allocation, room issues, move-in/out", keywords: ["hostel", "dorm", "room", "accommodation", "roommate", "aircon", "air-con", "move", "key"] },
  { id: "it", name: "IT Office", email: "it@xmu.edu.my", handles: "Wi-Fi, Moodle access, student accounts", keywords: ["wifi", "wi-fi", "internet", "moodle", "password", "login", "account", "email", "laptop", "printer"] },
  { id: "eca", name: "ECA Office", email: "eca@xmu.edu.my", handles: "Clubs, societies and activities", keywords: ["club", "society", "eca", "activity", "event", "register a club", "volunteer"] },
  { id: "intl", name: "International Office", email: "internationaloffice@xmu.edu.my", handles: "Visas, passports, international student matters", keywords: ["visa", "passport", "international", "immigration", "permit"] },
  { id: "affairs", name: "Student Affairs Office", email: "studentaffairs@xmu.edu.my", handles: "Student welfare, discipline, general support", keywords: ["welfare", "complaint", "discipline", "support", "lost", "found", "id card"] },
  { id: "counsel", name: "Counselling Centre", email: "counselling@xmu.edu.my", handles: "Wellbeing and confidential counselling", keywords: ["stress", "anxious", "anxiety", "counselling", "counseling", "lonely", "homesick", "wellbeing", "mental"] },
  { id: "career", name: "Career Services Office", email: "careerservices@xmu.edu.my", handles: "Internships, CVs, career events", keywords: ["internship", "career", "cv", "resume", "job"] },
  { id: "library", name: "Library", email: "librarian@xmu.edu.my", handles: "Borrowing, databases, study rooms", keywords: ["library", "book", "borrow", "database", "journal", "study room"] },
  { id: "aid", name: "Student Financial Aid Unit", email: "ptptn@xmu.edu.my", handles: "PTPTN and financial aid", keywords: ["ptptn", "loan", "financial aid", "scholarship", "aid"] },
];
