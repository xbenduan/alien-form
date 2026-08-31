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
  // 迭代数与运行端对齐：Cloudflare Workers 的 WebCrypto PBKDF2 上限为 100000。
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$100000$${salt}$${hash}`;
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
    deptCode: "DEPT-FAC-01",
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
    deptCode: "DEPT-GRADE-01-01",
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
    deptCode: "DEPT-GRADE-01-02",
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
    deptCode: "DEPT-CLASS-01-01-01",
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
    deptCode: "DEPT-CLASS-01-01-01",
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
    deptCode: "DEPT-CLASS-01-02-02",
    grade: "grade-5",
    className: "五年级二班",
    studentNo: "20260103",
    homeroomTeacherId: "user-teacher-3",
    status: "active",
    lastLoginAt: "2026-08-18",
    remark: "",
  },
  {
    id: "user-student-4",
    userNo: "S20260201",
    username: "sunlei",
    displayName: "孙磊",
    userType: "student",
    roleIds: ["role-student"],
    passwordHash: demoPasswordHash,
    gender: "male",
    phone: "13900002011",
    email: "sunlei@student.school.edu.cn",
    // 学生直接隶属「非班级部门」（团委）：单向 deptCode 指向即可，部门表无需登记成员。
    deptCode: "DEPT-PL-01-LEAGUE",
    grade: "grade-6",
    className: "六年级一班",
    studentNo: "20260201",
    homeroomTeacherId: "user-teacher-2",
    status: "active",
    lastLoginAt: "2026-08-20",
    remark: "隶属理工学部团委（演示学生属于非班级部门）。",
  },
  {
    id: "user-student-5",
    userNo: "S20260202",
    username: "zhouqi",
    displayName: "周琪",
    userType: "student",
    roleIds: ["role-student"],
    passwordHash: demoPasswordHash,
    gender: "female",
    phone: "13900002012",
    email: "zhouqi@student.school.edu.cn",
    deptCode: "DEPT-PL-01-UNION",
    grade: "grade-6",
    className: "六年级一班",
    studentNo: "20260202",
    homeroomTeacherId: "user-teacher-2",
    status: "active",
    lastLoginAt: "2026-08-19",
    remark: "隶属理工学部学生会（演示学生属于非班级部门）。",
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
    deptCode: "DEPT-FAC-01",
    department: "教务处",
    status: "active",
    lastLoginAt: "2026-08-20",
    remark: "体育选课系统管理员。",
  },
];

function buildUniversityUsers() {
  const faculties = ["理工学部", "经济管理学部", "人文学部", "外国语学部", "艺术学部"];
  const records = [];

  for (let facultyIndex = 1; facultyIndex <= faculties.length; facultyIndex += 1) {
    const facultyCode = `FAC-${String(facultyIndex).padStart(2, "0")}`;
    records.push({
      id: `org-${facultyCode.toLowerCase()}`,
      userNo: facultyCode,
      username: `org_${facultyCode.toLowerCase()}`,
      displayName: faculties[facultyIndex - 1],
      userType: "teacher",
      roleIds: ["role-school-leader"],
      passwordHash: demoPasswordHash,
      gender: facultyIndex % 2 ? "male" : "female",
      department: faculties[facultyIndex - 1],
      status: "active",
      deptCode: `DEPT-${facultyCode}`,
      remark: "学部负责人。",
    });

    for (let gradeIndex = 1; gradeIndex <= 4; gradeIndex += 1) {
      const gradeCode = `GRADE-${String(facultyIndex).padStart(2, "0")}-${String(
        gradeIndex,
      ).padStart(2, "0")}`;
      records.push({
        id: `org-${gradeCode.toLowerCase()}`,
        userNo: gradeCode,
        username: `org_${gradeCode.toLowerCase()}`,
        displayName: `${2021 + gradeIndex}级`,
        userType: "teacher",
        roleIds: ["role-grade-director"],
        passwordHash: demoPasswordHash,
        gender: "unknown",
        department: faculties[facultyIndex - 1],
        grade: `grade-${gradeIndex}`,
        status: "active",
        deptCode: `DEPT-${gradeCode}`,
        remark: "年级负责人。",
      });

      for (let classIndex = 1; classIndex <= 2; classIndex += 1) {
        const classCode = `CLASS-${String(facultyIndex).padStart(2, "0")}-${String(
          gradeIndex,
        ).padStart(2, "0")}-${String(classIndex).padStart(2, "0")}`;
        records.push({
          id: `org-${classCode.toLowerCase()}`,
          userNo: classCode,
          username: `org_${classCode.toLowerCase()}`,
          displayName: `${classIndex}班`,
          userType: "teacher",
          roleIds: ["role-homeroom-teacher"],
          passwordHash: demoPasswordHash,
          gender: classIndex % 2 ? "male" : "female",
          department: faculties[facultyIndex - 1],
          grade: `grade-${gradeIndex}`,
          className: `${2021 + gradeIndex}级${classIndex}班`,
          status: "active",
          deptCode: `DEPT-${classCode}`,
          remark: "班主任。",
        });

        for (let studentIndex = 1; studentIndex <= 5; studentIndex += 1) {
          const suffix = String(studentIndex).padStart(2, "0");
          const studentCode = `S-${String(facultyIndex).padStart(2, "0")}-${String(
            gradeIndex,
          ).padStart(2, "0")}-${String(classIndex).padStart(2, "0")}-${suffix}`;
          records.push({
            id: `student-${studentCode.toLowerCase()}`,
            userNo: studentCode,
            username: `student_${studentCode.toLowerCase().replaceAll("-", "_")}`,
            displayName: `${2021 + gradeIndex}级${classIndex}班学生${studentIndex}`,
            userType: "student",
            roleIds: ["role-student"],
            passwordHash: demoPasswordHash,
            gender: studentIndex % 2 ? "male" : "female",
            email: `${studentCode.toLowerCase().replaceAll("-", ".")}@student.gut.edu.cn`,
            grade: `grade-${gradeIndex}`,
            className: `${2021 + gradeIndex}级${classIndex}班`,
            studentNo: `${facultyIndex}${gradeIndex}${classIndex}${suffix}`,
            department: faculties[facultyIndex - 1],
            status: "active",
            deptCode: `DEPT-${classCode}`,
            remark: "",
          });
        }
      }
    }
  }

  return records;
}

users.push(...buildUniversityUsers());

/**
 * 组织/部门树（school-department）：把「组织结构」从 school-user 的人链里独立出来。
 *
 * 层级：学校根节点【不落库、不展示】→ 学部（森林根，parentCode=null）→ 年级 → 班级；
 * 学部下再挂独立于学生结构的党团组织（团委 / 学生会），它们不是班级。
 *
 * 单向隶属：部门只维护自己的层级（parentCode）与创建者/班主任，**不持有成员集**。
 * 「谁属于这个部门」完全由 school-user.deptCode 反向指向承载，部门表不冗余存成员。
 *
 * 约束落地（本次范围：只含班主任 + 学生，不含任课老师）：
 *  - 所有部门 creatorId 指向教师（org-fac-XX 是 userType=teacher 的组织节点）→「创建者必须是老师」。
 *  - 班级 homeroomTeacherId 指向教师（org-class-XX-YY-ZZ）→ 学生「绑班主任」由班级承载。
 *  - parentCode 存上级部门的 deptCode（文本自连接键，非外键）→ 前端 TreeSelect 选父级。
 * 引用的 creatorId / homeroomTeacherId 均为 school-user 记录的 id 值。
 */
function buildDepartments() {
  const facultyNames = ["理工学部", "经济管理学部", "人文学部", "外国语学部", "艺术学部"];
  const records = [];

  for (let f = 1; f <= facultyNames.length; f += 1) {
    const fac = String(f).padStart(2, "0");
    const facultyCode = `DEPT-FAC-${fac}`;
    const creatorId = `org-fac-${fac}`; // 学部组织节点（教师）作为创建者

    // 学部：森林根，parentCode = null（学校根节点不落库、不展示）
    records.push({
      id: `dept-fac-${fac}`,
      deptCode: facultyCode,
      deptName: facultyNames[f - 1],
      deptType: "faculty",
      parentCode: null,
      creatorId,
      sortOrder: f * 10,
      enabled: true,
      remark: "学部（组织树森林根，学校根节点不展示）。",
    });

    for (let g = 1; g <= 4; g += 1) {
      const grade = String(g).padStart(2, "0");
      const gradeCode = `DEPT-GRADE-${fac}-${grade}`;
      records.push({
        id: `dept-grade-${fac}-${grade}`,
        deptCode: gradeCode,
        deptName: `${2021 + g}级`,
        deptType: "grade",
        parentCode: facultyCode,
        creatorId,
        sortOrder: g,
        enabled: true,
        remark: "年级层级节点。",
      });

      for (let k = 1; k <= 2; k += 1) {
        const cls = String(k).padStart(2, "0");
        const classCode = `DEPT-CLASS-${fac}-${grade}-${cls}`;
        records.push({
          id: `dept-class-${fac}-${grade}-${cls}`,
          deptCode: classCode,
          deptName: `${2021 + g}级${k}班`,
          deptType: "class",
          parentCode: gradeCode,
          // 班主任 = 班级组织节点（教师）；创建者同为教师
          homeroomTeacherId: `org-class-${fac}-${grade}-${cls}`,
          creatorId,
          sortOrder: k,
          enabled: true,
          remark: "班级：绑定班主任，学生通过自身 deptCode 隶属本班。",
        });
      }
    }

    // 党团组织：直接挂在学部下（选学部为父级），独立于年级/班级结构。
    // 成员同样由学生自身 deptCode 指向这里承载（见 buildUniversityUsers 的演示学生）。
    records.push({
      id: `dept-league-${fac}`,
      deptCode: `DEPT-PL-${fac}-LEAGUE`,
      deptName: `${facultyNames[f - 1]}团委`,
      deptType: "party-league",
      parentCode: facultyCode,
      creatorId,
      sortOrder: 91,
      enabled: true,
      remark: "党团组织：非班级部门，可容纳跨班学生。",
    });
    records.push({
      id: `dept-union-${fac}`,
      deptCode: `DEPT-PL-${fac}-UNION`,
      deptName: `${facultyNames[f - 1]}学生会`,
      deptType: "party-league",
      parentCode: facultyCode,
      creatorId,
      sortOrder: 92,
      enabled: true,
      remark: "党团组织：非班级部门，可容纳跨班学生。",
    });
  }

  return records;
}

const departments = buildDepartments();


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

// 灌入顺序即依赖顺序：role/user 先于 department（引用 user 的班主任/创建者/成员）
// 与 course（引用 user 的授课教师）。
const groups = [
  { model: "school-role", records: roles },
  { model: "school-user", records: users },
  { model: "school-department", records: departments },
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

// ---------------------------------------------------------------------------
// SQL 生成模式（用于 Cloudflare D1 直灌）：
//   node scripts/seed.js --sql            # 输出到 scripts/seed.sql
//   node scripts/seed.js --sql out.sql    # 自定义输出路径
//
// Cloudflare Worker 后端的 /api/records/* 需要登录，而种子本身要创建首批用户，
// 存在「鸡生蛋」。因此对 D1 直接写库：把每条记录拍成 records 表的一行——
// 系统字段（id/model/created_at/updated_at）成列，其余字段收进 data_content JSON，
// 与 worker 的存储格式完全一致。生成后执行：
//   wrangler d1 execute alien-mdm --remote --file scripts/seed.sql
// 记录用 (model,id) 做 upsert，可重复执行不产生重复数据。
// ---------------------------------------------------------------------------
function sqlQuote(text) {
  return `'${String(text).replaceAll("'", "''")}'`;
}

function generateSql() {
  const now = Date.now();
  const lines = [
    "-- 由 scripts/seed.js --sql 自动生成，请勿手改。",
    "-- 执行：wrangler d1 execute alien-mdm --remote --file scripts/seed.sql",
    "",
  ];
  let total = 0;
  for (const { model, records } of groups) {
    lines.push(`-- ${model}（${records.length} 条）`);
    for (const record of records) {
      const { id, createdAt: _c, updatedAt: _u, ...data } = record;
      const dataContent = JSON.stringify(data);
      lines.push(
        `INSERT INTO "records" (id, model, created_at, updated_at, data_content) VALUES ` +
          `(${sqlQuote(id)}, ${sqlQuote(model)}, ${now}, ${now}, ${sqlQuote(dataContent)}) ` +
          `ON CONFLICT(model, id) DO UPDATE SET updated_at = excluded.updated_at, data_content = excluded.data_content;`,
      );
      total += 1;
    }
    lines.push("");
  }

  const { writeFileSync } = require("node:fs");
  const { resolve } = require("node:path");
  const outArg = process.argv.find((arg, i) => i >= 3 && !arg.startsWith("--"));
  const outPath = resolve(__dirname, outArg ?? "seed.sql");
  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`[seed] 已生成 SQL：${outPath}（共 ${total} 条记录）`);
}

if (process.argv.includes("--sql")) {
  generateSql();
} else {
  main().catch((err) => {
    console.error(`[seed] 失败：${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
