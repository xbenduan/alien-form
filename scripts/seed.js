// 通过 HTTP 接口灌入演示数据的种子脚本。
//
// 与旧的 DB 直写 seed 不同：这里不接触数据库，只调用运行中的
// alien-server 的 POST /api/records/:model 接口创建数据。运行前请先启动后端
// （pnpm dev / pnpm dev:server）。
//
// 用法：
//   node script/seed.js                 # 默认 http://localhost:8787
//   API_BASE=http://localhost:9000 node script/seed.js
//   PORT=9000 node script/seed.js
//
// 说明：
//   - 记录自带 id，接口按 id 幂等 upsert，可重复执行不会产生重复数据。
//   - createdAt / updatedAt 由服务端统一管理，无需也无法从这里写入。

const { pbkdf2Sync, randomBytes } = require("node:crypto");
const API_BASE = process.env.API_BASE ?? `http://localhost:${process.env.PORT ?? 8787}`;
const DEMO_PASSWORD = "alien123456";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 120_000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

const demoPasswordHash = hashPassword(DEMO_PASSWORD);

const roles = [
  {
    id: "role-student",
    roleCode: "STUDENT",
    roleName: "学生",
    roleType: "student",
    roleLevel: "self",
    viewableTables: ["school-course"],
    description: "查看课程列表并参与体育课程报名。",
    enabled: true,
    sortOrder: 10,
  },
  {
    id: "role-course-teacher",
    roleCode: "COURSE_TEACHER",
    roleName: "课程老师",
    roleType: "course-teacher",
    roleLevel: "self",
    viewableTables: ["school-course", "school-user"],
    description: "查看和维护本人负责的体育课程信息。",
    enabled: true,
    sortOrder: 20,
  },
  {
    id: "role-homeroom-teacher",
    roleCode: "HOMEROOM_TEACHER",
    roleName: "班主任",
    roleType: "homeroom-teacher",
    roleLevel: "class",
    viewableTables: ["school-course", "school-user"],
    description: "查看本班学生和可报名体育课程。",
    enabled: true,
    sortOrder: 30,
  },
  {
    id: "role-grade-director",
    roleCode: "GRADE_DIRECTOR",
    roleName: "年级主任",
    roleType: "grade-director",
    roleLevel: "grade",
    viewableTables: ["school-course", "school-user"],
    description: "查看年级用户和课程报名情况。",
    enabled: true,
    sortOrder: 40,
  },
  {
    id: "role-school-leader",
    roleCode: "SCHOOL_LEADER",
    roleName: "校级领导",
    roleType: "school-leader",
    roleLevel: "school",
    viewableTables: ["school-course", "school-user", "school-role"],
    description: "查看全校体育课程、用户和角色数据。",
    enabled: true,
    sortOrder: 50,
  },
  {
    id: "role-academic-admin",
    roleCode: "ACADEMIC_ADMIN",
    roleName: "教务管理员",
    roleType: "academic-admin",
    roleLevel: "school",
    viewableTables: ["school-course", "school-user", "school-role"],
    description: "负责体育选课基础数据和报名计划维护。",
    enabled: true,
    sortOrder: 60,
  },
];

const users = [
  {
    id: "user-teacher-1",
    userNo: "T2026001",
    username: "zhangwei",
    displayName: "张伟",
    userType: "teacher",
    roleIds: ["role-course-teacher"],
    passwordHash: demoPasswordHash,
    gender: "male",
    phone: "13800001001",
    email: "zhangwei@school.edu.cn",
    department: "体育教研组",
    teacherTitle: "lecturer",
    status: "active",
    lastLoginAt: "2026-08-19",
    remark: "负责球类课程教学。",
  },
  {
    id: "user-teacher-2",
    userNo: "T2026002",
    username: "liuna",
    displayName: "刘娜",
    userType: "teacher",
    roleIds: ["role-course-teacher", "role-homeroom-teacher"],
    passwordHash: demoPasswordHash,
    gender: "female",
    phone: "13800001002",
    email: "liuna@school.edu.cn",
    department: "体育教研组",
    teacherTitle: "associate-professor",
    status: "active",
    lastLoginAt: "2026-08-20",
    remark: "负责羽毛球和网球课程，同时担任六年级一班班主任。",
  },
  {
    id: "user-teacher-3",
    userNo: "T2026003",
    username: "wangjun",
    displayName: "王军",
    userType: "teacher",
    roleIds: ["role-course-teacher", "role-grade-director"],
    passwordHash: demoPasswordHash,
    gender: "male",
    phone: "13800001003",
    email: "wangjun@school.edu.cn",
    department: "体育教研组",
    teacherTitle: "professor",
    status: "active",
    lastLoginAt: "2026-08-18",
    remark: "负责足球课程和六年级年级管理。",
  },
  {
    id: "user-student-1",
    userNo: "S20260101",
    username: "chenxi",
    displayName: "陈希",
    userType: "student",
    roleIds: ["role-student"],
    passwordHash: demoPasswordHash,
    gender: "female",
    phone: "13900002001",
    email: "chenxi@student.school.edu.cn",
    grade: "grade-6",
    className: "六年级一班",
    studentNo: "20260101",
    homeroomTeacherId: "user-teacher-2",
    status: "active",
    lastLoginAt: "2026-08-20",
    remark: "",
  },
  {
    id: "user-student-2",
    userNo: "S20260102",
    username: "liyang",
    displayName: "李阳",
    userType: "student",
    roleIds: ["role-student"],
    passwordHash: demoPasswordHash,
    gender: "male",
    phone: "13900002002",
    email: "liyang@student.school.edu.cn",
    grade: "grade-6",
    className: "六年级一班",
    studentNo: "20260102",
    homeroomTeacherId: "user-teacher-2",
    status: "active",
    lastLoginAt: "2026-08-19",
    remark: "",
  },
  {
    id: "user-student-3",
    userNo: "S20260103",
    username: "zhaomeng",
    displayName: "赵梦",
    userType: "student",
    roleIds: ["role-student"],
    passwordHash: demoPasswordHash,
    gender: "female",
    phone: "13900002003",
    email: "zhaomeng@student.school.edu.cn",
    grade: "grade-5",
    className: "五年级二班",
    studentNo: "20260103",
    homeroomTeacherId: "user-teacher-3",
    status: "active",
    lastLoginAt: "2026-08-18",
    remark: "",
  },
  {
    id: "user-admin-1",
    userNo: "A2026001",
    username: "jiaowu",
    displayName: "教务管理员",
    userType: "academic-admin",
    roleIds: ["role-academic-admin"],
    passwordHash: demoPasswordHash,
    gender: "female",
    phone: "13800001010",
    email: "jiaowu@school.edu.cn",
    department: "教务处",
    status: "active",
    lastLoginAt: "2026-08-20",
    remark: "体育选课系统管理员。",
  },
];

const courses = [
  {
    id: "course-basketball",
    courseCode: "PE-BASKETBALL-01",
    courseName: "篮球基础与实战",
    sportType: "basketball",
    teacherId: "user-teacher-1",
    semester: "2026-autumn",
    gradeScope: ["grade-5", "grade-6"],
    courseDescription: "学习篮球基本技术、团队配合和基础比赛规则。",
    credits: 1,
    maxCapacity: 40,
    enrolledCount: 32,
    waitlistEnabled: true,
    waitlistCapacity: 10,
    waitlistCount: 3,
    registrationStartAt: "2026-08-25 08:00",
    registrationEndAt: "2026-08-27 23:59",
    registrationSlots: [
      {
        slotName: "第一轮报名",
        startAt: "2026-08-25 08:00",
        endAt: "2026-08-25 12:00",
        quota: 20,
        enrolledCount: 20,
        status: "closed",
      },
      {
        slotName: "第二轮报名",
        startAt: "2026-08-26 08:00",
        endAt: "2026-08-27 23:59",
        quota: 20,
        enrolledCount: 12,
        status: "open",
      },
    ],
    classStartDate: "2026-09-01",
    classEndDate: "2026-12-31",
    weeklySchedule: "周二 16:00-17:30",
    location: "东校区篮球场",
    status: "registration",
    notes: "需自备运动鞋和饮用水。",
  },
  {
    id: "course-badminton",
    courseCode: "PE-BADMINTON-01",
    courseName: "羽毛球入门",
    sportType: "badminton",
    teacherId: "user-teacher-2",
    semester: "2026-autumn",
    gradeScope: ["grade-4", "grade-5", "grade-6"],
    courseDescription: "面向初学者，训练握拍、发球、步法和基础对打。",
    credits: 1,
    maxCapacity: 24,
    enrolledCount: 18,
    waitlistEnabled: true,
    waitlistCapacity: 6,
    waitlistCount: 0,
    registrationStartAt: "2026-08-25 08:00",
    registrationEndAt: "2026-08-27 23:59",
    registrationSlots: [
      {
        slotName: "统一报名",
        startAt: "2026-08-25 08:00",
        endAt: "2026-08-27 23:59",
        quota: 24,
        enrolledCount: 18,
        status: "open",
      },
    ],
    classStartDate: "2026-09-02",
    classEndDate: "2026-12-30",
    weeklySchedule: "周三 16:00-17:30",
    location: "体育馆一号场",
    status: "registration",
    notes: "学校提供球拍，也可自带球拍。",
  },
  {
    id: "course-tennis",
    courseCode: "PE-TENNIS-01",
    courseName: "网球基础",
    sportType: "tennis",
    teacherId: "user-teacher-2",
    semester: "2026-autumn",
    gradeScope: ["grade-5", "grade-6"],
    courseDescription: "学习网球基本击球技术、移动和单打规则。",
    credits: 1,
    maxCapacity: 16,
    enrolledCount: 16,
    waitlistEnabled: true,
    waitlistCapacity: 4,
    waitlistCount: 5,
    registrationStartAt: "2026-08-25 08:00",
    registrationEndAt: "2026-08-27 23:59",
    registrationSlots: [
      {
        slotName: "统一报名",
        startAt: "2026-08-25 08:00",
        endAt: "2026-08-27 23:59",
        quota: 16,
        enrolledCount: 16,
        status: "closed",
      },
    ],
    classStartDate: "2026-09-03",
    classEndDate: "2026-12-31",
    weeklySchedule: "周四 16:00-17:30",
    location: "西校区网球场",
    status: "closed",
    notes: "报名已满，可加入候补名单。",
  },
  {
    id: "course-football",
    courseCode: "PE-FOOTBALL-01",
    courseName: "足球基础与团队配合",
    sportType: "football",
    teacherId: "user-teacher-3",
    semester: "2026-autumn",
    gradeScope: ["grade-4", "grade-5", "grade-6"],
    courseDescription: "训练传接球、带球、射门和团队攻防配合。",
    credits: 1,
    maxCapacity: 30,
    enrolledCount: 21,
    waitlistEnabled: false,
    waitlistCapacity: 0,
    waitlistCount: 0,
    registrationStartAt: "2026-08-26 08:00",
    registrationEndAt: "2026-08-28 23:59",
    registrationSlots: [
      {
        slotName: "第一轮报名",
        startAt: "2026-08-26 08:00",
        endAt: "2026-08-26 18:00",
        quota: 15,
        enrolledCount: 15,
        status: "closed",
      },
      {
        slotName: "第二轮报名",
        startAt: "2026-08-27 08:00",
        endAt: "2026-08-28 23:59",
        quota: 15,
        enrolledCount: 6,
        status: "open",
      },
    ],
    classStartDate: "2026-09-04",
    classEndDate: "2026-12-25",
    weeklySchedule: "周五 16:00-17:30",
    location: "北校区足球场",
    status: "registration",
    notes: "雨天课程调整至室内综合馆。",
  },
  {
    id: "course-swimming",
    courseCode: "PE-SWIMMING-01",
    courseName: "游泳安全与基础",
    sportType: "swimming",
    teacherId: "user-teacher-3",
    semester: "2026-autumn",
    gradeScope: ["grade-5", "grade-6"],
    courseDescription: "学习水中安全、蛙泳基础和体能训练。",
    credits: 1,
    maxCapacity: 20,
    enrolledCount: 0,
    waitlistEnabled: true,
    waitlistCapacity: 5,
    waitlistCount: 0,
    registrationStartAt: "2026-08-30 08:00",
    registrationEndAt: "2026-09-01 23:59",
    registrationSlots: [
      {
        slotName: "统一报名",
        startAt: "2026-08-30 08:00",
        endAt: "2026-09-01 23:59",
        quota: 20,
        enrolledCount: 0,
        status: "pending",
      },
    ],
    classStartDate: "2026-09-07",
    classEndDate: "2026-12-28",
    weeklySchedule: "周一 16:00-17:30",
    location: "校游泳馆",
    status: "pending",
    notes: "报名学生须提交健康和安全承诺。",
  },
];

// 灌入顺序即依赖顺序：role/user 先于 course（course 引用 teacherId）。
const groups = [
  { model: "school-role", records: roles },
  { model: "school-user", records: users },
  { model: "school-course", records: courses },
];

async function ensureServerUp() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new Error(`健康检查返回 ${res.status}`);
  } catch (err) {
    console.error(`[seed] 无法连接后端 ${API_BASE}，请先启动服务（pnpm dev:server）。`);
    console.error(`[seed] 原因：${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function createRecord(model, record) {
  const res = await fetch(`${API_BASE}/api/records/${model}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`POST /api/records/${model} (${record.id}) -> ${res.status} ${detail}`);
  }
}

async function main() {
  console.log(`[seed] 目标后端：${API_BASE}`);
  await ensureServerUp();

  for (const { model, records } of groups) {
    for (const record of records) {
      await createRecord(model, record);
      console.log(`[seed] ✓ ${model} ${record.id}`);
    }
  }

  const total = groups.reduce((sum, g) => sum + g.records.length, 0);
  console.log(`[seed] 完成，共写入 ${total} 条记录。`);
}

main().catch((err) => {
  console.error(`[seed] 失败：${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
